"""Seed the database with common exercises and starter workouts.

Idempotent: adds any exercises/workouts that are missing by name, so it is
safe to re-run (e.g. `make run` seeds on every start) and to run against a
database that was seeded by an older version.
"""
import json
from pathlib import Path

from app.database import SessionLocal, run_migrations
from app.models.models import Exercise, WorkoutTemplate, WorkoutTemplateExercise

SEED_EXERCISES = [
    # ──────────────────────────────────────────────────────────
    #  Cardio (8-14 kcal/min)
    # ──────────────────────────────────────────────────────────
    {"name": "Jumping Jacks", "category": "cardio", "default_kcal_per_min": 8.0, "description": "Classic full-body jumping jack"},
    {"name": "High Knees", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Run in place bringing knees up high"},
    {"name": "Burpees", "category": "cardio", "default_kcal_per_min": 12.0, "description": "Full burpee: squat, plank, jump"},
    {"name": "Mountain Climbers", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Plank position, alternating knees to chest"},
    {"name": "Jump Rope", "category": "cardio", "default_kcal_per_min": 11.0, "description": "Simulated jump rope"},
    {"name": "Running in Place", "category": "cardio", "default_kcal_per_min": 9.0, "description": "Jog on the spot"},
    {"name": "Butt Kicks", "category": "cardio", "default_kcal_per_min": 8.0, "description": "Jogging while kicking heels to glutes"},
    {"name": "Skater Hops", "category": "cardio", "default_kcal_per_min": 9.0, "description": "Lateral hops like a speed skater"},
    {"name": "Box Jumps", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Jump onto an imaginary box and step down"},
    {"name": "Jump Squats", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Squat down and explode into a jump"},
    {"name": "Step-ups", "category": "cardio", "default_kcal_per_min": 8.0, "description": "Step up onto a sturdy surface and back down, alternating"},
    {"name": "Tuck Jumps", "category": "cardio", "default_kcal_per_min": 11.0, "description": "Jump straight up and tuck knees toward the chest"},
    {"name": "Plank Jacks", "category": "cardio", "default_kcal_per_min": 9.0, "description": "From a plank, jump feet wide and back together"},
    {"name": "Star Jumps", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Jump up spreading arms and legs wide like a star"},
    {"name": "Froggers", "category": "cardio", "default_kcal_per_min": 10.0, "description": "From a plank, jump both feet forward to hands, then back"},
    {"name": "Inchworms", "category": "cardio", "default_kcal_per_min": 7.0, "description": "Walk hands out to plank, walk feet in, stand up"},
    {"name": "Bear Crawls", "category": "cardio", "default_kcal_per_min": 9.0, "description": "Crawl forward and backward on hands and feet, hips low"},
    {"name": "Crab Walks", "category": "cardio", "default_kcal_per_min": 8.0, "description": "Walk on hands and feet face-up, hips lifted"},
    {"name": "Lateral Shuffles", "category": "cardio", "default_kcal_per_min": 9.0, "description": "Side-to-side shuffle in an athletic stance"},
    {"name": "Jumping Lunges", "category": "cardio", "default_kcal_per_min": 11.0, "description": "Alternating lunge jumps switching legs in the air"},
    {"name": "Broad Jumps", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Jump forward as far as possible with a two-foot landing"},
    {"name": "Squat Jacks", "category": "cardio", "default_kcal_per_min": 9.0, "description": "In a squat hold, hop feet wide and narrow"},
    {"name": "Fast Feet", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Rapid-fire small steps staying on the balls of the feet"},
    {"name": "Cross-Body Mountain Climbers", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Drive knee to opposite elbow from plank — obliques + cardio"},
    {"name": "Seal Jacks", "category": "cardio", "default_kcal_per_min": 8.0, "description": "Like jumping jacks but clap in front, opening arms out"},
    {"name": "Sprint Knee Drives", "category": "cardio", "default_kcal_per_min": 12.0, "description": "Drive knees up rapidly like sprinting in place"},
    {"name": "Shadow Boxing", "category": "cardio", "default_kcal_per_min": 9.0, "description": "Throw punches at the air — jab, cross, hook, uppercut combos"},
    {"name": "Speed Skaters", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Long lateral bounds reaching the back leg behind"},
    {"name": "Split Jumps", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Start in a lunge, jump and switch legs mid-air"},
    {"name": "Pogo Jumps", "category": "cardio", "default_kcal_per_min": 9.0, "description": "Small rapid two-foot hops, staying stiff and springy"},
    {"name": "Squat Thrusts", "category": "cardio", "default_kcal_per_min": 11.0, "description": "Burpee without the push-up — squat, plank, back, stand"},
    {"name": "Kneeling Get-ups", "category": "cardio", "default_kcal_per_min": 8.0, "description": "From kneeling to standing and back without hands"},
    {"name": "Sprawls", "category": "cardio", "default_kcal_per_min": 12.0, "description": "Drop to plank position, jump back up — like a burpee without the push-up"},
    {"name": "Lateral Hops", "category": "cardio", "default_kcal_per_min": 9.0, "description": "Hop side to side over a line on one or both feet"},
    {"name": "High Knee Skips", "category": "cardio", "default_kcal_per_min": 9.0, "description": "Skip in place with exaggerated knee drive"},
    {"name": "Power Skips", "category": "cardio", "default_kcal_per_min": 11.0, "description": "Explosive skipping with maximum height and opposite-arm reach"},
    {"name": "Front Kicks", "category": "cardio", "default_kcal_per_min": 8.0, "description": "Alternating straight-leg front kicks at hip height"},

    # ──────────────────────────────────────────────────────────
    #  Strength: bodyweight (4-8 kcal/min)
    # ──────────────────────────────────────────────────────────
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

    # ── Standing legs & glutes ──
    {"name": "Sumo Squats", "category": "strength", "default_kcal_per_min": 7.0, "description": "Wide-stance squat, toes out — inner thigh and glute focus"},
    {"name": "Squat Pulses", "category": "strength", "default_kcal_per_min": 6.0, "description": "Hold the bottom of a squat and pulse up and down"},
    {"name": "Side Lunges", "category": "strength", "default_kcal_per_min": 6.0, "description": "Step out to the side and sit into one hip, alternating"},
    {"name": "Curtsy Lunges", "category": "strength", "default_kcal_per_min": 6.0, "description": "Step one leg behind and across into a curtsy"},
    {"name": "Good Mornings", "category": "strength", "default_kcal_per_min": 5.0, "description": "Hands behind head, hinge at the hips with a flat back"},
    {"name": "Standing Oblique Crunches", "category": "strength", "default_kcal_per_min": 5.0, "description": "Standing, bring elbow to same-side knee, alternating"},
    {"name": "Bulgarian Split Squats", "category": "strength", "default_kcal_per_min": 7.0, "description": "Rear foot elevated on a chair, single-leg squat"},
    {"name": "Single-Leg Glute Bridges", "category": "strength", "default_kcal_per_min": 5.0, "description": "Glute bridge with one leg extended straight"},
    {"name": "Hip Thrusts", "category": "strength", "default_kcal_per_min": 6.0, "description": "Upper back on a bench or mat, drive hips up"},
    {"name": "Clamshells", "category": "strength", "default_kcal_per_min": 4.0, "description": "Lie on side, knees bent, open and close top knee"},
    {"name": "Fire Hydrants", "category": "strength", "default_kcal_per_min": 5.0, "description": "On all fours, lift one knee out to the side like a dog at a hydrant"},
    {"name": "Narrow Squats", "category": "strength", "default_kcal_per_min": 7.0, "description": "Feet together squat — quad-dominant"},
    {"name": "Cossack Squats", "category": "strength", "default_kcal_per_min": 7.0, "description": "Deep side-to-side squats, alternating — hip mobility and strength"},
    {"name": "Single-Leg Deadlifts", "category": "strength", "default_kcal_per_min": 6.0, "description": "Stand on one leg, hinge forward lifting the other leg behind"},

    # ── Push-up variations ──
    {"name": "Wide Push-ups", "category": "strength", "default_kcal_per_min": 7.0, "description": "Hands wider than shoulder-width — chest emphasis"},
    {"name": "Narrow Push-ups", "category": "strength", "default_kcal_per_min": 7.5, "description": "Hands close together — triceps and inner chest"},
    {"name": "Decline Push-ups", "category": "strength", "default_kcal_per_min": 8.0, "description": "Feet elevated on a chair or step — upper chest"},
    {"name": "Incline Push-ups", "category": "strength", "default_kcal_per_min": 6.0, "description": "Hands elevated — beginner-friendly push-up"},
    {"name": "Spiderman Push-ups", "category": "strength", "default_kcal_per_min": 7.5, "description": "Bring knee to elbow on each rep — core + chest"},
    {"name": "Hindu Push-ups", "category": "strength", "default_kcal_per_min": 8.0, "description": "Dive-bomber motion from downward dog to upward dog"},
    {"name": "Dive Bomber Push-ups", "category": "strength", "default_kcal_per_min": 8.0, "description": "Arc forward and up like diving under a fence"},
    {"name": "Plyo Push-ups", "category": "strength", "default_kcal_per_min": 9.0, "description": "Push up explosively so hands leave the floor"},
    {"name": "Knee Push-ups", "category": "strength", "default_kcal_per_min": 5.5, "description": "Push-up on knees — beginner progression"},

    # ── Plank variations ──
    {"name": "Forearm Plank", "category": "strength", "default_kcal_per_min": 4.5, "description": "Plank on forearms instead of hands"},
    {"name": "Plank Walk-ups", "category": "strength", "default_kcal_per_min": 6.0, "description": "Alternate from forearm plank to straight-arm plank and back"},
    {"name": "Plank to Downward Dog", "category": "strength", "default_kcal_per_min": 5.0, "description": "Flow from plank pushing hips up into downward dog"},
    {"name": "Bear Plank", "category": "strength", "default_kcal_per_min": 5.0, "description": "Plank with knees hovering just off the floor"},
    {"name": "Side Plank Dips", "category": "strength", "default_kcal_per_min": 5.5, "description": "From side plank, dip the hip down and lift"},
    {"name": "Side Plank with Leg Lift", "category": "strength", "default_kcal_per_min": 5.5, "description": "Side plank raising the top leg"},
    {"name": "Straight-Arm Plank", "category": "strength", "default_kcal_per_min": 5.0, "description": "High plank on hands with locked elbows"},

    # ── Calisthenics ──
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
    {"name": "L-Sit Hold", "category": "strength", "default_kcal_per_min": 6.0, "description": "Seated, hands by hips, lift legs straight out — advanced core"},
    {"name": "Hanging Knee Raises", "category": "strength", "default_kcal_per_min": 6.0, "description": "Hang from a bar and raise knees to chest"},
    {"name": "Australian Pull-ups", "category": "strength", "default_kcal_per_min": 7.0, "description": "Bodyweight row under a low bar, feet on floor"},
    {"name": "Muscle-ups", "category": "strength", "default_kcal_per_min": 10.0, "description": "Pull-up into a dip in one fluid motion"},
    {"name": "Toes-to-Bar", "category": "strength", "default_kcal_per_min": 7.0, "description": "Hang and bring toes all the way to the bar"},
    {"name": "Skin the Cat", "category": "strength", "default_kcal_per_min": 6.0, "description": "Hanging, tuck knees through arms and roll backward"},
    {"name": "False Grip Hold", "category": "strength", "default_kcal_per_min": 5.0, "description": "Hanging hold with wrist over the bar — muscle-up prep"},

    # ── Core & floor work ──
    {"name": "Tuck Sit Hold", "category": "strength", "default_kcal_per_min": 5.0, "description": "Seated, knees tucked, hips off floor"},
    {"name": "Seated Leg Raises", "category": "strength", "default_kcal_per_min": 5.0, "description": "Sit tall, hands by hips, lift and lower straight legs"},
    {"name": "Lying Leg Raises", "category": "strength", "default_kcal_per_min": 6.0, "description": "Lie on your back, raise straight legs to vertical and lower slowly"},
    {"name": "Dead Bug", "category": "strength", "default_kcal_per_min": 5.0, "description": "On your back, extend opposite arm and leg"},
    {"name": "Flutter Kicks", "category": "strength", "default_kcal_per_min": 6.0, "description": "Small rapid alternating leg kicks on your back"},
    {"name": "Russian Twists", "category": "strength", "default_kcal_per_min": 6.0, "description": "Seated, lean back and rotate torso side to side"},
    {"name": "Sit-ups", "category": "strength", "default_kcal_per_min": 6.0, "description": "Full sit-up from the mat"},
    {"name": "Reverse Lunges", "category": "strength", "default_kcal_per_min": 6.0, "description": "Step backward into a lunge, alternating"},
    {"name": "Donkey Kicks", "category": "strength", "default_kcal_per_min": 5.0, "description": "On all fours, drive one heel toward the ceiling"},
    {"name": "Side Plank", "category": "strength", "default_kcal_per_min": 5.0, "description": "Hold a straight-body plank on one forearm"},
    {"name": "Bird Dog", "category": "strength", "default_kcal_per_min": 4.0, "description": "On all fours, extend opposite arm and leg, hold and switch"},
    {"name": "Plank Shoulder Taps", "category": "strength", "default_kcal_per_min": 6.0, "description": "From a plank, tap hand to opposite shoulder"},
    {"name": "Reverse Crunches", "category": "strength", "default_kcal_per_min": 6.0, "description": "Curl knees toward the chest lifting hips"},
    {"name": "Scissor Kicks", "category": "strength", "default_kcal_per_min": 6.0, "description": "Cross straight legs over and under, alternating"},
    {"name": "Heel Taps", "category": "strength", "default_kcal_per_min": 5.0, "description": "In a crunch, tap each heel side to side"},
    {"name": "V-ups", "category": "strength", "default_kcal_per_min": 7.0, "description": "Simultaneously lift legs and torso to touch toes"},
    {"name": "Crunches", "category": "strength", "default_kcal_per_min": 5.0, "description": "Classic crunch — lift shoulders off the mat"},
    {"name": "Oblique Crunches", "category": "strength", "default_kcal_per_min": 5.0, "description": "Crunch reaching toward the opposite knee"},
    {"name": "Hollow Body Rocks", "category": "strength", "default_kcal_per_min": 6.0, "description": "Hold hollow body and rock back and forth"},
    {"name": "Windshield Wipers", "category": "strength", "default_kcal_per_min": 6.5, "description": "Legs up, lower from side to side — advanced obliques"},
    {"name": "Leg Raise Circles", "category": "strength", "default_kcal_per_min": 5.5, "description": "On your back, draw circles with straight legs together"},
    {"name": "Butterfly Sit-ups", "category": "strength", "default_kcal_per_min": 6.0, "description": "Soles of feet together, knees out — sit up from this position"},
    {"name": "Swimmers", "category": "strength", "default_kcal_per_min": 5.0, "description": "Lie prone, flutter arms and legs — posterior chain"},
    {"name": "Prone Y Raises", "category": "strength", "default_kcal_per_min": 4.0, "description": "Face down, raise arms into a Y shape — upper back"},
    {"name": "Prone T Raises", "category": "strength", "default_kcal_per_min": 4.0, "description": "Face down, raise arms into a T shape — rear delts"},
    {"name": "Arch Body Hold", "category": "strength", "default_kcal_per_min": 4.0, "description": "Lie prone, lift arms and legs into a gentle arch"},

    # ──────────────────────────────────────────────────────────
    #  Dumbbell exercises (5-9 kcal/min)
    # ──────────────────────────────────────────────────────────
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
    {"name": "Dumbbell Romanian Deadlifts", "category": "strength", "default_kcal_per_min": 7.0, "description": "Hinge the hips, dumbbells close to legs"},
    {"name": "Hammer Curls", "category": "strength", "default_kcal_per_min": 5.0, "description": "Neutral-grip dumbbell curls"},
    {"name": "Dumbbell Front Raises", "category": "strength", "default_kcal_per_min": 5.0, "description": "Raise dumbbells straight in front to shoulder height"},
    {"name": "Dumbbell Floor Press", "category": "strength", "default_kcal_per_min": 6.0, "description": "Lie on the mat, press dumbbells from the chest"},
    {"name": "Renegade Rows", "category": "strength", "default_kcal_per_min": 7.0, "description": "In a plank on dumbbells, row one up at a time"},
    {"name": "Dumbbell Pullover", "category": "strength", "default_kcal_per_min": 6.0, "description": "Lie on back, lower dumbbell behind head in an arc"},
    {"name": "Dumbbell Kickbacks", "category": "strength", "default_kcal_per_min": 5.0, "description": "Bent over, extend dumbbell back for triceps"},
    {"name": "Concentration Curls", "category": "strength", "default_kcal_per_min": 5.0, "description": "Seated, curl dumbbell with elbow braced against inner thigh"},
    {"name": "Arnold Press", "category": "strength", "default_kcal_per_min": 6.5, "description": "Shoulder press rotating palms from facing you to forward"},
    {"name": "Dumbbell Upright Rows", "category": "strength", "default_kcal_per_min": 6.0, "description": "Pull dumbbells up along the body to chin height"},
    {"name": "Dumbbell Shrugs", "category": "strength", "default_kcal_per_min": 4.5, "description": "Shrug shoulders up with dumbbells — traps"},
    {"name": "Farmers Walk", "category": "strength", "default_kcal_per_min": 7.0, "description": "Walk holding heavy dumbbells at your sides"},
    {"name": "Dumbbell Side Bends", "category": "strength", "default_kcal_per_min": 4.5, "description": "Lean to one side with a dumbbell — obliques"},
    {"name": "Overhead Tricep Extensions", "category": "strength", "default_kcal_per_min": 5.0, "description": "Both hands, one dumbbell, lower behind head"},
    {"name": "Dumbbell Reverse Flyes", "category": "strength", "default_kcal_per_min": 5.0, "description": "Bent over, open arms to sides — rear delts"},
    {"name": "Dumbbell Chest Flyes", "category": "strength", "default_kcal_per_min": 5.5, "description": "Lie on back, open arms wide and bring dumbbells together"},
    {"name": "Dumbbell Bent-Over Rows", "category": "strength", "default_kcal_per_min": 6.5, "description": "Both arms row with hinged torso — full back"},
    {"name": "Dumbbell Push Press", "category": "strength", "default_kcal_per_min": 8.0, "description": "Dip the knees and drive dumbbells overhead"},
    {"name": "Dumbbell Snatch", "category": "strength", "default_kcal_per_min": 9.0, "description": "One dumbbell from floor to overhead in one motion"},
    {"name": "Dumbbell Clean and Press", "category": "strength", "default_kcal_per_min": 9.0, "description": "Clean dumbbells to shoulders, then press overhead"},
    {"name": "Dumbbell Wrist Curls", "category": "strength", "default_kcal_per_min": 3.5, "description": "Forearms on knees, curl dumbbells with wrists only"},
    {"name": "Reverse Wrist Curls", "category": "strength", "default_kcal_per_min": 3.5, "description": "Palms down wrist curls — forearm extensors"},
    {"name": "Zottman Curls", "category": "strength", "default_kcal_per_min": 5.0, "description": "Curl up with palms up, lower with palms down"},

    # ──────────────────────────────────────────────────────────
    #  Flexibility & mobility (2-4 kcal/min)
    # ──────────────────────────────────────────────────────────
    {"name": "Toe Touches", "category": "flexibility", "default_kcal_per_min": 3.0, "description": "Standing forward fold"},
    {"name": "Arm Circles", "category": "flexibility", "default_kcal_per_min": 3.0, "description": "Large circles with both arms"},
    {"name": "Neck Rolls", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Gentle neck stretches"},
    {"name": "Cat-Cow Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Spinal mobility on all fours"},
    {"name": "Hip Circles", "category": "flexibility", "default_kcal_per_min": 3.0, "description": "Rotate hips in a circle"},
    {"name": "Shoulder Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Cross-body arm stretch"},
    {"name": "Hamstring Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Standing hamstring stretch"},
    {"name": "Quad Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Standing quad pull to glute"},
    {"name": "Child's Pose", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "Kneel, fold forward with arms extended — restorative"},
    {"name": "Downward Dog", "category": "flexibility", "default_kcal_per_min": 3.0, "description": "Hips up, heels toward floor, inverted V shape"},
    {"name": "Upward Dog", "category": "flexibility", "default_kcal_per_min": 3.0, "description": "Prone, press chest up with straight arms"},
    {"name": "Cobra Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Lie prone, lift chest keeping hips on the floor"},
    {"name": "Pigeon Pose", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "One leg forward bent, other leg extended back — hip opener"},
    {"name": "Butterfly Stretch", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "Seated, soles together, knees out — groin stretch"},
    {"name": "Seated Forward Fold", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "Legs extended, reach for toes"},
    {"name": "Standing Forward Fold", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Stand, hinge at hips and fold forward"},
    {"name": "Low Lunge Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "One foot forward in a lunge, back knee down — hip flexor"},
    {"name": "Thread the Needle", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "From all fours, reach one arm under the body"},
    {"name": "Spinal Twist", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "Seated, twist torso to one side using opposite arm"},
    {"name": "Happy Baby", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "On back, grab feet and pull knees toward armpits"},
    {"name": "Figure Four Stretch", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "On back, cross one ankle over opposite knee — glute stretch"},
    {"name": "World's Greatest Stretch", "category": "flexibility", "default_kcal_per_min": 3.0, "description": "Lunge, twist torso open, elbow to instep — full-body mobility"},
    {"name": "90/90 Stretch", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "Seated, both legs bent 90° — hip internal/external rotation"},
    {"name": "Couch Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Back knee against a wall or couch — deep quad/hip flexor"},
    {"name": "Triceps Stretch", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "Reach one hand down the spine, elbow up"},
    {"name": "Chest Opener Stretch", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "Clasp hands behind back and lift arms"},
    {"name": "Wrist Circles", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "Rotate wrists in both directions"},
    {"name": "Ankle Circles", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "Rotate each ankle in both directions"},
    {"name": "Shoulder Rolls", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Roll shoulders forward and backward"},
    {"name": "Standing Side Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Reach one arm overhead and lean to the side"},
    {"name": "Supine Twist", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "On back, drop both knees to one side"},
    {"name": "Lying Knee to Chest", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "On back, hug one knee to the chest"},
    {"name": "Reclining Pigeon", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "Figure four on your back — gentle hip opener"},
    {"name": "Bridge Pose", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Press hips up while keeping shoulders on the mat"},
    {"name": "Calf Stretch", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "Hands against wall, one leg back with heel on floor"},
    {"name": "Inner Thigh Stretch", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "Seated, legs wide apart, fold forward"},
    {"name": "IT Band Stretch", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "Standing, cross one leg behind and lean away"},
    {"name": "Lizard Lunge", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "From a low lunge, walk hands inside front foot — deep hip opener"},
    {"name": "Puppy Pose", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "From all fours, walk hands forward, chest toward floor"},
    {"name": "Eagle Arms", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "Cross arms at elbows and wrap forearms — upper back"},
    {"name": "Saddle Stretch", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "Kneel with knees apart, lean back — quad/hip flexor"},
    {"name": "Frog Stretch", "category": "flexibility", "default_kcal_per_min": 2.0, "description": "On all fours, knees wide, sink hips back — groin/hips"},
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
    run_migrations()
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
