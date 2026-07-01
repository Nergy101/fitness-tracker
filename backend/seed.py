"""Seed the database with common exercises and starter workouts.

Idempotent: adds any exercises/workouts that are missing by name, so it is
safe to re-run (e.g. `make run` seeds on every start) and to run against a
database that was seeded by an older version.
"""
import json
from pathlib import Path

from app.database import SessionLocal, engine, Base, ensure_schema
from app.models.models import Exercise, WorkoutTemplate, WorkoutTemplateExercise

SEED_EXERCISES = [
    # ── Cardio (8-12 kcal/min) ──────────────────────────────
    {"name": "Jumping Jacks", "category": "cardio", "default_kcal_per_min": 8.0, "description": "Classic full-body jumping jack"},
    {"name": "High Knees", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Run in place bringing knees up high"},
    {"name": "Burpees", "category": "cardio", "default_kcal_per_min": 12.0, "description": "Full burpee: squat, plank, jump"},
    {"name": "Mountain Climbers", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Plank position, alternating knees to chest"},
    {"name": "Jump Rope", "category": "cardio", "default_kcal_per_min": 11.0, "description": "Simulated jump rope"},
    {"name": "Running in Place", "category": "cardio", "default_kcal_per_min": 9.0, "description": "Jog on the spot"},
    {"name": "Butt Kicks", "category": "cardio", "default_kcal_per_min": 8.0, "description": "Jogging while kicking heels to glutes"},
    {"name": "Skater Hops", "category": "cardio", "default_kcal_per_min": 9.0, "description": "Lateral hops like a speed skater"},
    {"name": "Box Jumps", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Jump onto an imaginary box and step down"},

    # ── Strength: bodyweight basics (4-8 kcal/min) ──────────
    {"name": "Push-ups", "category": "strength", "default_kcal_per_min": 7.0, "description": "Standard push-up"},
    {"name": "Squats", "category": "strength", "default_kcal_per_min": 7.0, "description": "Bodyweight squats"},
    {"name": "Lunges", "category": "strength", "default_kcal_per_min": 6.0, "description": "Alternating forward lunges"},
    {"name": "Plank", "category": "strength", "default_kcal_per_min": 5.0, "description": "Hold a straight-body plank position"},
    {"name": "Tricep Dips", "category": "strength", "default_kcal_per_min": 6.0, "description": "Dips on a chair or bench"},
    {"name": "Glute Bridges", "category": "strength", "default_kcal_per_min": 5.0, "description": "Lie on back, lift hips up"},
    {"name": "Wall Sit", "category": "strength", "default_kcal_per_min": 5.0, "description": "Sit against a wall at 90 degrees"},
    {"name": "Calf Raises", "category": "strength", "default_kcal_per_min": 4.0, "description": "Standing calf raises"},
    {"name": "Bicycle Crunches", "category": "strength", "default_kcal_per_min": 6.0, "description": "Twisting bicycle motion for abs"},
    {"name": "Superman Hold", "category": "strength", "default_kcal_per_min": 4.0, "description": "Lie face down, lift arms and legs"},

    # ── Standing legs & glutes (5-10 kcal/min) ──────────────
    {"name": "Sumo Squats", "category": "strength", "default_kcal_per_min": 7.0, "description": "Wide-stance squat, toes out — inner thigh and glute focus"},
    {"name": "Squat Pulses", "category": "strength", "default_kcal_per_min": 6.0, "description": "Hold the bottom of a squat and pulse up and down a few inches"},
    {"name": "Side Lunges", "category": "strength", "default_kcal_per_min": 6.0, "description": "Step out to the side and sit into one hip, alternating"},
    {"name": "Curtsy Lunges", "category": "strength", "default_kcal_per_min": 6.0, "description": "Step one leg behind and across into a curtsy — glute medius focus"},
    {"name": "Jump Squats", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Squat down and explode into a jump"},
    {"name": "Good Mornings", "category": "strength", "default_kcal_per_min": 5.0, "description": "Hands behind head, hinge at the hips with a flat back — hamstrings"},
    {"name": "Standing Oblique Crunches", "category": "strength", "default_kcal_per_min": 5.0, "description": "Standing, bring elbow to same-side knee, alternating"},
    {"name": "Step-ups", "category": "cardio", "default_kcal_per_min": 8.0, "description": "Step up onto a sturdy surface and back down, alternating"},

    # ── Calisthenics (strength, 5-8 kcal/min) ───────────────
    {"name": "Pull-ups", "category": "strength", "default_kcal_per_min": 8.0, "description": "Overhand grip, pull chin over the bar"},
    {"name": "Chin-ups", "category": "strength", "default_kcal_per_min": 8.0, "description": "Underhand grip pull-up, biceps focus"},
    {"name": "Dips", "category": "strength", "default_kcal_per_min": 7.0, "description": "Parallel-bar dips, chest and triceps"},
    {"name": "Pike Push-ups", "category": "strength", "default_kcal_per_min": 7.0, "description": "Hips high, push-up targeting shoulders"},
    {"name": "Diamond Push-ups", "category": "strength", "default_kcal_per_min": 7.5, "description": "Hands together, triceps-focused push-up"},
    {"name": "Archer Push-ups", "category": "strength", "default_kcal_per_min": 7.5, "description": "Wide push-up shifting weight side to side"},
    {"name": "Pistol Squats", "category": "strength", "default_kcal_per_min": 8.0, "description": "Single-leg squat to full depth"},
    {"name": "Inverted Rows", "category": "strength", "default_kcal_per_min": 7.0, "description": "Horizontal body row under a bar"},
    {"name": "Hanging Leg Raises", "category": "strength", "default_kcal_per_min": 6.0, "description": "Hang from a bar and raise legs to hips"},
    {"name": "Hollow Body Hold", "category": "strength", "default_kcal_per_min": 5.0, "description": "Lie on back, hold a tight hollow position"},

    # ── Core & legs — beginner floor work (4-7 kcal/min) ────
    {"name": "Tuck Sit Hold", "category": "strength", "default_kcal_per_min": 5.0, "description": "Seated on the mat, knees tucked, lift hips off the floor — the first step toward an L-sit / T-sit"},
    {"name": "Seated Leg Raises", "category": "strength", "default_kcal_per_min": 5.0, "description": "Sit tall, hands by hips, lift and lower straight legs — builds toward the L-sit"},
    {"name": "Lying Leg Raises", "category": "strength", "default_kcal_per_min": 6.0, "description": "Lie on your back, raise straight legs to vertical and lower slowly"},
    {"name": "Dead Bug", "category": "strength", "default_kcal_per_min": 5.0, "description": "On your back, extend opposite arm and leg while keeping the low back flat"},
    {"name": "Flutter Kicks", "category": "strength", "default_kcal_per_min": 6.0, "description": "Lie on your back, small rapid alternating leg kicks"},
    {"name": "Russian Twists", "category": "strength", "default_kcal_per_min": 6.0, "description": "Seated, lean back and rotate the torso side to side (hold a dumbbell to progress)"},
    {"name": "Sit-ups", "category": "strength", "default_kcal_per_min": 6.0, "description": "Full sit-up from the mat"},
    {"name": "Reverse Lunges", "category": "strength", "default_kcal_per_min": 6.0, "description": "Step backward into a lunge, alternating legs — knee-friendly leg builder"},
    {"name": "Donkey Kicks", "category": "strength", "default_kcal_per_min": 5.0, "description": "On all fours, drive one heel toward the ceiling — glute focus"},
    {"name": "Side Plank", "category": "strength", "default_kcal_per_min": 5.0, "description": "Hold a straight-body plank on one forearm, hips lifted (per side)"},

    # ── Floor core — prone & supine (4-7 kcal/min) ──────────
    {"name": "Bird Dog", "category": "strength", "default_kcal_per_min": 4.0, "description": "On all fours, extend opposite arm and leg, hold and switch"},
    {"name": "Plank Shoulder Taps", "category": "strength", "default_kcal_per_min": 6.0, "description": "From a plank, tap each hand to the opposite shoulder without rocking"},
    {"name": "Reverse Crunches", "category": "strength", "default_kcal_per_min": 6.0, "description": "Lie on your back and curl the knees toward the chest, lifting the hips"},
    {"name": "Scissor Kicks", "category": "strength", "default_kcal_per_min": 6.0, "description": "On your back, cross straight legs over and under, alternating"},
    {"name": "Heel Taps", "category": "strength", "default_kcal_per_min": 5.0, "description": "Lie on your back in a crunch, tap each heel side to side — obliques"},
    {"name": "V-ups", "category": "strength", "default_kcal_per_min": 7.0, "description": "Lie flat, simultaneously lift legs and torso to touch toes"},

    # ── Dumbbell (strength, 5-9 kcal/min) ───────────────────
    {"name": "Dumbbell Curls", "category": "strength", "default_kcal_per_min": 5.0, "description": "Standing biceps curls with dumbbells"},
    {"name": "Dumbbell Shoulder Press", "category": "strength", "default_kcal_per_min": 6.0, "description": "Press dumbbells overhead"},
    {"name": "Dumbbell Bench Press", "category": "strength", "default_kcal_per_min": 6.0, "description": "Chest press with dumbbells"},
    {"name": "Dumbbell Rows", "category": "strength", "default_kcal_per_min": 6.0, "description": "Bent-over single-arm dumbbell row"},
    {"name": "Dumbbell Lunges", "category": "strength", "default_kcal_per_min": 7.0, "description": "Forward lunges holding dumbbells"},
    {"name": "Goblet Squats", "category": "strength", "default_kcal_per_min": 7.0, "description": "Squat holding one dumbbell at the chest"},
    {"name": "Dumbbell Deadlifts", "category": "strength", "default_kcal_per_min": 7.0, "description": "Hip-hinge deadlift with dumbbells"},
    {"name": "Dumbbell Lateral Raises", "category": "strength", "default_kcal_per_min": 5.0, "description": "Raise dumbbells out to the sides"},
    {"name": "Dumbbell Tricep Extensions", "category": "strength", "default_kcal_per_min": 5.0, "description": "Overhead triceps extension with a dumbbell"},
    {"name": "Dumbbell Thrusters", "category": "strength", "default_kcal_per_min": 9.0, "description": "Squat into an overhead press with dumbbells"},

    # ── Dumbbell — added (5-8 kcal/min) ─────────────────────
    {"name": "Dumbbell Romanian Deadlifts", "category": "strength", "default_kcal_per_min": 7.0, "description": "Soft knees, hinge the hips back lowering dumbbells along the legs — hamstrings/glutes"},
    {"name": "Hammer Curls", "category": "strength", "default_kcal_per_min": 5.0, "description": "Neutral-grip dumbbell curls — biceps and forearms"},
    {"name": "Dumbbell Front Raises", "category": "strength", "default_kcal_per_min": 5.0, "description": "Raise dumbbells straight in front to shoulder height"},
    {"name": "Dumbbell Floor Press", "category": "strength", "default_kcal_per_min": 6.0, "description": "Lie on the mat and press dumbbells from the chest — triceps/chest"},
    {"name": "Renegade Rows", "category": "strength", "default_kcal_per_min": 7.0, "description": "In a plank on the dumbbells, row one up at a time — back and core"},

    # ── Flexibility (2-4 kcal/min) ──────────────────────────
    {"name": "Toe Touches", "category": "flexibility", "default_kcal_per_min": 3.0, "description": "Standing forward fold"},
    {"name": "Arm Circles", "category": "flexibility", "default_kcal_per_min": 3.0, "description": "Large circles with both arms"},
    {"name": "Neck Rolls", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Gentle neck stretches"},
    {"name": "Cat-Cow Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Spinal mobility on all fours"},
    {"name": "Hip Circles", "category": "flexibility", "default_kcal_per_min": 3.0, "description": "Rotate hips in a circle"},
    {"name": "Shoulder Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Cross-body arm stretch"},
    {"name": "Hamstring Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Standing hamstring stretch"},
    {"name": "Quad Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Standing quad pull to glute"},
]

# Each workout is a list of (exercise_name, duration_seconds). Names must exist
# in SEED_EXERCISES above.
SEED_WORKOUTS = [
    {
        "name": "Basic",
        "description": "Full-body no-equipment circuit. ~14 min/round × 3.",
        "rounds": 3,
        "rest": 90,
        "exercises": [
            # — standing —
            ("Jumping Jacks", 45),
            ("High Knees", 40),
            ("Squats", 45),
            ("Sumo Squats", 45),
            ("Reverse Lunges", 45),
            ("Side Lunges", 40),
            ("Calf Raises", 40),
            ("Good Mornings", 40),
            ("Wall Sit", 45),
            # — floor: prone / all-fours —
            ("Push-ups", 40),
            ("Plank Shoulder Taps", 40),
            ("Plank", 45),
            ("Bird Dog", 40),
            ("Superman Hold", 40),
            # — floor: supine core —
            ("Glute Bridges", 45),
            ("Bicycle Crunches", 40),
            ("Reverse Crunches", 40),
            ("Flutter Kicks", 40),
            ("Heel Taps", 40),
            ("Sit-ups", 40),
        ],
    },
    {
        "name": "Calisthenics",
        "description": "Bar + bodyweight strength. ~13 min/round × 3.",
        "rounds": 3,
        "rest": 120,
        "exercises": [
            # — at the bar (hanging / vertical) —
            ("Pull-ups", 30),
            ("Chin-ups", 30),
            ("Inverted Rows", 35),
            ("Hanging Leg Raises", 35),
            ("Dips", 35),
            # — standing legs —
            ("Pistol Squats", 40),
            ("Squats", 45),
            ("Sumo Squats", 40),
            ("Jump Squats", 35),
            # — floor: prone push —
            ("Diamond Push-ups", 35),
            ("Archer Push-ups", 35),
            ("Pike Push-ups", 35),
            ("Push-ups", 40),
            ("Plank Shoulder Taps", 40),
            ("Side Plank", 40),
            ("Plank", 45),
            # — floor: supine core —
            ("Hollow Body Hold", 40),
            ("V-ups", 35),
            ("Bicycle Crunches", 40),
            ("Lying Leg Raises", 40),
            ("Reverse Crunches", 40),
        ],
    },
    {
        "name": "Beginner Calisthenics",
        "description": "Gentle mat-based core & legs, builds toward the L-sit / T-sit. ~13 min/round × 3.",
        "rounds": 3,
        "rest": 90,
        "exercises": [
            # — standing —
            ("Squats", 40),
            ("Reverse Lunges", 40),
            ("Side Lunges", 35),
            ("Sumo Squats", 35),
            ("Calf Raises", 35),
            ("Good Mornings", 35),
            # — floor: all-fours / prone —
            ("Bird Dog", 40),
            ("Donkey Kicks", 35),
            ("Plank", 30),
            ("Superman Hold", 35),
            # — floor: supine —
            ("Glute Bridges", 40),
            ("Dead Bug", 40),
            ("Lying Leg Raises", 35),
            ("Reverse Crunches", 35),
            ("Scissor Kicks", 30),
            ("Flutter Kicks", 30),
            ("Heel Taps", 35),
            ("Bicycle Crunches", 35),
            ("Sit-ups", 35),
            # — seated (L-sit progression) —
            ("Tuck Sit Hold", 25),
            ("Seated Leg Raises", 35),
            ("Russian Twists", 35),
        ],
    },
    {
        "name": "Cardio",
        "description": "In-place cardio burner, mat only. ~14 min/round × 3.",
        "rounds": 3,
        "rest": 60,
        "exercises": [
            # — standing (stay on your feet) —
            ("Jumping Jacks", 50),
            ("High Knees", 45),
            ("Butt Kicks", 45),
            ("Running in Place", 45),
            ("Skater Hops", 45),
            ("Jump Squats", 40),
            ("Squat Pulses", 40),
            ("Jump Rope", 50),
            ("Step-ups", 45),
            ("Box Jumps", 45),
            ("Lunges", 45),
            ("Curtsy Lunges", 40),
            ("Standing Oblique Crunches", 40),
            # — floor (down once, to finish) —
            ("Burpees", 40),
            ("Mountain Climbers", 45),
            ("Plank Shoulder Taps", 40),
            ("Flutter Kicks", 35),
            ("Bicycle Crunches", 40),
        ],
    },
    {
        "name": "Dumbbells",
        "description": "Full-body dumbbell strength. ~13 min/round × 3.",
        "rounds": 3,
        "rest": 120,
        "exercises": [
            # — standing: legs & hinge —
            ("Goblet Squats", 45),
            ("Sumo Squats", 40),
            ("Dumbbell Lunges", 45),
            ("Dumbbell Romanian Deadlifts", 45),
            ("Dumbbell Deadlifts", 45),
            ("Good Mornings", 35),
            # — standing: push & pull —
            ("Dumbbell Rows", 40),
            ("Dumbbell Thrusters", 40),
            ("Dumbbell Shoulder Press", 40),
            ("Dumbbell Lateral Raises", 35),
            ("Dumbbell Front Raises", 35),
            ("Dumbbell Curls", 35),
            ("Hammer Curls", 35),
            ("Dumbbell Tricep Extensions", 35),
            # — floor —
            ("Dumbbell Floor Press", 40),
            ("Renegade Rows", 40),
            ("Plank", 40),
            ("Russian Twists", 40),
            ("Bicycle Crunches", 40),
        ],
    },
]


def seed():
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    db = SessionLocal()
    try:
        # Image mapping (produced by scripts/import_exercise_images.py). Absent
        # is fine — exercises just fall back to an icon on the frontend.
        images_path = Path(__file__).resolve().parent / "exercise_images.json"
        image_by_name: dict[str, str] = {}
        if images_path.exists():
            image_by_name = json.loads(images_path.read_text())

        # Exercises: add any missing by name.
        existing = {e.name: e for e in db.query(Exercise).all()}
        added_ex = 0
        for ex in SEED_EXERCISES:
            if ex["name"] not in existing:
                db.add(Exercise(
                    **ex,
                    default_duration_seconds=30,
                    image_url=image_by_name.get(ex["name"]),
                ))
                added_ex += 1
            elif existing[ex["name"]].image_url is None and ex["name"] in image_by_name:
                # Backfill image on rows seeded before images existed.
                existing[ex["name"]].image_url = image_by_name[ex["name"]]
        db.commit()

        by_name = {e.name: e for e in db.query(Exercise).all()}

        # Workouts: create any missing by name.
        existing_workouts = {w.name for w in db.query(WorkoutTemplate).all()}
        added_wk = 0
        for wk in SEED_WORKOUTS:
            if wk["name"] in existing_workouts:
                continue
            template = WorkoutTemplate(name=wk["name"], description=wk["description"], rounds=wk["rounds"], rest_between_rounds=wk["rest"])
            db.add(template)
            db.flush()
            for i, (ex_name, duration) in enumerate(wk["exercises"]):
                exercise = by_name.get(ex_name)
                if exercise is None:
                    raise ValueError(
                        f"Workout '{wk['name']}' references unknown exercise '{ex_name}'"
                    )
                db.add(WorkoutTemplateExercise(
                    template_id=template.id,
                    exercise_id=exercise.id,
                    duration_seconds=duration,
                    order_index=i,
                ))
            added_wk += 1
        db.commit()

        print(
            f"Seed complete: +{added_ex} exercises (total {len(by_name)}), "
            f"+{added_wk} workouts (total {db.query(WorkoutTemplate).count()})."
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed()
