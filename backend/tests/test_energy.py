"""Behavioral tests for app.energy — the cycling kcal model.

Contracts defended:
- MET rises with average speed and is clamped to the published range.
- Between published speed bands the MET is interpolated, not stepped.
- kcal is active (above-resting) energy: (MET - 1) x kg x hours.
- Same distance, different duration => different burn (the whole reason the
  flat 0.45 kcal/kg/km factor was replaced).
- Degenerate rides (no time, no distance) are 0.0, never a divide-by-zero.
"""

import pytest

from app.energy import cycling_kcal, cycling_met, legacy_cycling_kcal


class TestCyclingMet:
    def test_matches_published_anchors(self):
        """Compendium band midpoints map to their published MET values."""
        assert cycling_met(15.1) == 5.8
        assert cycling_met(17.6) == 6.8
        assert cycling_met(20.8) == 8.0
        assert cycling_met(24.1) == 10.0
        assert cycling_met(28.2) == 12.0

    def test_clamps_below_and_above_the_published_range(self):
        assert cycling_met(3.0) == 3.5
        assert cycling_met(8.9) == 3.5
        assert cycling_met(32.2) == 16.8
        assert cycling_met(60.0) == 16.8

    def test_interpolates_between_anchors(self):
        """Halfway between the 17.6 (6.8) and 20.8 (8.0) anchors is 7.4 — the
        published bands are steps, and stepping would swing a ride's estimate
        ~18% on a 0.2 km/h difference in average speed."""
        assert cycling_met(19.2) == pytest.approx(7.4)

    def test_strictly_increases_with_speed(self):
        speeds = [5.0, 10.0, 15.0, 17.0, 19.0, 21.0, 23.0, 25.0, 27.0, 30.0]
        mets = [cycling_met(s) for s in speeds]
        assert mets == sorted(mets)
        assert len(set(mets)) == len(mets)


class TestCyclingKcal:
    def test_active_energy_subtracts_resting_metabolism(self):
        """1 MET is 1 kcal/kg/h, so a 1 h ride at 17.6 km/h for an 80 kg rider
        burns 6.8 x 80 = 544 gross and (6.8 - 1) x 80 = 464 active."""
        assert cycling_kcal(17.6, 3600, 80.0) == 464.0

    def test_scales_with_weight_and_duration(self):
        assert cycling_kcal(17.6, 3600, 40.0) == 232.0
        assert cycling_kcal(35.2, 7200, 80.0) == 928.0

    def test_same_distance_slower_ride_is_not_the_same_burn(self):
        """35 km in 1 h is a hard ride; 35 km in 3 h is a coffee run. The old
        distance-only factor scored them identically."""
        fast = cycling_kcal(35.0, 3600, 80.0)
        slow = cycling_kcal(35.0, 3 * 3600, 80.0)
        assert fast > slow
        assert legacy_cycling_kcal(35.0, 80.0) == legacy_cycling_kcal(35.0, 80.0)

    def test_moderate_ride_lands_near_watch_reported_active_energy(self):
        """A 1.5 h, 28 km ride (18.7 km/h) for an 80 kg rider: ~744 kcal
        active, versus 1008 under the old flat factor — which read ~35% high
        against watch-measured active energy."""
        active = cycling_kcal(28.0, 5400, 80.0)
        assert 650.0 <= active <= 800.0
        assert active < legacy_cycling_kcal(28.0, 80.0)

    def test_degenerate_rides_are_zero(self):
        assert cycling_kcal(10.0, 0, 80.0) == 0.0
        assert cycling_kcal(0.0, 3600, 80.0) == 0.0
