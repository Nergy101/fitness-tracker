"""Seed the database with common exercises."""
from app.database import SessionLocal, engine, Base
from app.models.models import Exercise

SEED_EXERCISES = [
    # Cardio (8-12 kcal/min)
    {"name": "Jumping Jacks", "category": "cardio", "default_kcal_per_min": 8.0, "description": "Classic full-body jumping jack"},
    {"name": "High Knees", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Run in place bringing knees up high"},
    {"name": "Burpees", "category": "cardio", "default_kcal_per_min": 12.0, "description": "Full burpee: squat, plank, jump"},
    {"name": "Mountain Climbers", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Plank position, alternating knees to chest"},
    {"name": "Jump Rope", "category": "cardio", "default_kcal_per_min": 11.0, "description": "Simulated jump rope"},
    {"name": "Running in Place", "category": "cardio", "default_kcal_per_min": 9.0, "description": "Jog on the spot"},
    {"name": "Butt Kicks", "category": "cardio", "default_kcal_per_min": 8.0, "description": "Jogging while kicking heels to glutes"},
    {"name": "Skater Hops", "category": "cardio", "default_kcal_per_min": 9.0, "description": "Lateral hops like a speed skater"},
    {"name": "Box Jumps", "category": "cardio", "default_kcal_per_min": 10.0, "description": "Jump onto an imaginary box and step down"},

    # Strength (5-8 kcal/min)
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

    # Flexibility (3-4 kcal/min)
    {"name": "Toe Touches", "category": "flexibility", "default_kcal_per_min": 3.0, "description": "Standing forward fold"},
    {"name": "Arm Circles", "category": "flexibility", "default_kcal_per_min": 3.0, "description": "Large circles with both arms"},
    {"name": "Neck Rolls", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Gentle neck stretches"},
    {"name": "Cat-Cow Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Spinal mobility on all fours"},
    {"name": "Hip Circles", "category": "flexibility", "default_kcal_per_min": 3.0, "description": "Rotate hips in a circle"},
    {"name": "Shoulder Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Cross-body arm stretch"},
    {"name": "Hamstring Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Standing hamstring stretch"},
    {"name": "Quad Stretch", "category": "flexibility", "default_kcal_per_min": 2.5, "description": "Standing quad pull to glute"},
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    existing = db.query(Exercise).count()
    if existing > 0:
        print(f"Database already has {existing} exercises, skipping seed.")
        db.close()
        return

    for ex_data in SEED_EXERCISES:
        exercise = Exercise(**ex_data, default_duration_seconds=30)
        db.add(exercise)

    db.commit()
    count = db.query(Exercise).count()
    print(f"Seeded {count} exercises.")
    db.close()


if __name__ == "__main__":
    seed()
