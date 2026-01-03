import json

with open('source.json', 'r') as f:
    data = json.load(f)

# Update metadata
data['meta__brand_name'] = "Berk Dragon Academy"
data['s00_intro__core__title'] = "Dragon Training 101"
data['s00_intro__core__description'] = "The comprehensive guide to understanding, taming, and riding dragons for a harmonious existence."
data['s01_story__core__title'] = "The Viking's Dilemma"
data['s01_story__core__content'] = "For generations, we fought them. We feared them. But one Viking dared to look closer and discovered a bond that would change our world forever. This course is built on that legacy of understanding over conflict."

# Offer
data['s02_offer__core__product_name'] = "Dragon Rider Certification"
data['s02_offer__core__price'] = "500 Gold Pieces"
data['s02_offer__core__investment_terms'] = "One-time payment or 3 monthly installments of 175 Gold Pieces."
data['s02_offer__core__short_description'] = "A complete training program taking you from fear to flight in 12 weeks."
data['s02_offer__core__unique_mechanism_tagline'] = "The Trust-Bond Method"
data['s02_offer__core__unique_mechanism_description'] = "Unlike traditional suppression techniques, our method focuses on mutual respect and non-verbal communication to establish a lifelong bond."
data['s02_offer__core__delivery_format'] = "Weekly live flight sessions and daily training drills."
data['s02_offer__core__delivery_access'] = "Lifetime access to the dragon arena and scroll library."
data['s02_offer__core__delivery_community'] = "Private clan forum for riders to share tips and routes."
data['s02_offer__core__delivery_advisory'] = "Monthly Q&A with Hiccup and Toothless."

# Features (Genericizing for brevity in script, but providing detail)
features = [
    ("Dragon Anatomy & Physiology", "Understand the fire types, flight mechanics, and weak spots."),
    ("Non-Verbal Communication", "Master the art of gestures and touch to earn a dragon's trust."),
    ("Saddle Crafting", "Design and build custom gear for safe and comfortable riding."),
    ("Aerial Maneuvers", "Learn basic take-offs, barrel rolls, and combat evasion."),
    ("Feeding & Nutrition", "What to feed different species to keep them healthy and happy."),
    ("Dragon Psychology", "Why they do what they do, and how to predict their behavior."),
    ("Emergency Protocols", "What to do when a dragon goes feral or gets injured."),
    ("Formation Flying", "Coordinate with other riders for defense and display."),
    ("Species Identification", "Recognize the Deadly Nadder, Gronckle, and Night Fury."),
    ("The Alpha Connection", "Advanced techniques for leading a pack.")
]
for i in range(1, 11):
    key_base = f"s02_offer__feature_{i:02d}"
    if i <= len(features):
        data[f"{key_base}__title"] = features[i-1][0]
        data[f"{key_base}__description"] = features[i-1][1]

# Pains
pains = [
    ("Fear of Fire", "Constant worry about your house burning down.", "I sleep with a bucket of water.", "My roof is thatch!", "It's too hot.", 8),
    ("Social Isolation", "Being the only one who likes dragons.", "They think I'm crazy.", "No one understands.", "I'm an outcast.", 7),
    ("Physical Danger", "Risk of losing a limb.", "Hooks for hands are not cool.", "I need my legs.", "Dragons bite.", 9),
    ("Lack of Knowledge", "Not knowing which dragons are friendly.", "Is that a Gronckle?", "I don't know.", "What does it eat?", 6),
    ("Village Pressure", "The chief demands dragon slaying.", "Dad will kill me.", "I have to kill a dragon.", "Honor the clan.", 8),
    ("Dragon Raids", "Losing sheep every night.", "There goes my dinner.", "We're starving.", "They took the yak.", 7),
    ("Ineffective Weapons", "Swords don't work on scales.", "It bounced off.", "I need a net.", "My axe broke.", 6),
    ("Flying Envy", "Wishing you could soar.", "Look at them go.", "I want to fly.", "Walking is slow.", 5),
    ("Misunderstood Creatures", "Feeling they aren't monsters.", "It has a soul.", "Look at its eyes.", "It's just scared.", 7),
    ("Conflict Fatigue", "Tired of the endless war.", "When will it end?", "Too many funerals.", "Make peace.", 9)
]
for i in range(1, 11):
    base = f"s03_pains__pain_{i:02d}"
    p = pains[i-1]
    data[f"{base}__title"] = p[0]
    data[f"{base}__description"] = p[1]
    data[f"{base}__quote_01"] = p[2]
    data[f"{base}__quote_02"] = p[3]
    data[f"{base}__quote_03"] = p[4]
    data[f"{base}__score"] = p[5]

# Desires
desires = [
    ("Flight Mastery", "Soaring above the clouds.", "Touch the sky.", "Freedom!", "Wind in my hair.", "Solo flight certification"),
    ("Dragon Bond", "A best friend for life.", "He listens to me.", "We are one.", "Loyalty forever.", "Named dragon companion"),
    ("Village Hero", "Respect from the clan.", "They cheer for me.", "Dad is proud.", "I saved the day.", "Medal of honor"),
    ("Adventure", "Exploring the unknown.", "New lands.", "Hidden worlds.", "Map the edges.", "Discovery of new island"),
    ("Peace", "Living in harmony.", "No more fighting.", "Dragons are pets.", "Safe homes.", "Treaty signed")
]
for i in range(1, 6):
    base = f"s04_desires__desire_{i:02d}"
    d = desires[i-1]
    data[f"{base}__title"] = d[0]
    data[f"{base}__vision_snapshot"] = d[1]
    data[f"{base}__emotional_win"] = d[2]
    data[f"{base}__quote_01"] = d[3]
    data[f"{base}__quote_02"] = d[4]
    data[f"{base}__quote_03"] = d[2] # Reuse
    data[f"{base}__tangible_milestones"] = d[5]

# Authority
data['s05_authority__core__title'] = "Led by the First Rider"
data['s05_authority__historical_01'] = "First to train a Night Fury."
data['s05_authority__historical_02'] = "Ended the 300-year Dragon War."
data['s05_authority__historical_03'] = "Chief of the Berk Dragon Academy."
data['s05_authority__historical_04'] = "Mapped the entire archipelago."
data['s05_authority__historical_05'] = "Inventor of the dragon saddle."
data['s05_authority__credentials_01'] = "Certified Dragon Master"
data['s05_authority__credentials_02'] = "Head of Berk Defense"
data['s05_authority__credentials_03'] = "Alpha Protector"

# Competitors
data['s06_competitors__competitor_01__name'] = "Dragon Slayers Guild"
data['s06_competitors__competitor_01__offering'] = "Weaponry and Traps"
data['s06_competitors__competitor_01__usp'] = "Brute force elimination."
data['s06_competitors__competitor_01__pricing'] = "High cost in lives."
data['s06_competitors__competitor_01__website'] = "slayers.berk"

# Audience
data['s07_audience__demographics__age'] = "12-25 years old"
data['s07_audience__demographics__gender'] = "All genders"
data['s07_audience__demographics__income'] = "Various (Barter system accepted)"
data['s07_audience__demographics__education'] = "Basic Viking training"
data['s07_audience__demographics__occupation'] = "Students, blacksmiths, farmers"
data['s07_audience__demographics__family'] = "Clans and families"
data['s07_audience__demographics__location'] = "Isle of Berk and surrounding archipelago"

# Values
data['s08_values__synthesis'] = "Courage, Curiosity, and Compassion"
data['s08_values__value_01__name'] = "Bravery"
data['s08_values__value_01__explanation'] = "Facing fears to achieve greatness."

# Transformation
data['s09_transformation__before'] = "Fearful ground-dweller fighting for survival."
data['s09_transformation__after'] = "Confident dragon rider exploring the world."
data['s09_transformation__emotional_shift'] = "From terror to wonder."
data['s09_transformation__impact'] = "A changed world where dragons and humans live as one."

# Media (Placeholders)
data['s10_media__social_01__name'] = "DragonGram"
data['s10_media__social_01__url'] = "dragongram.com"

# Objections
data['s11_objections__objection_01__objection'] = "Dragons are dangerous monsters."
data['s11_objections__objection_01__rebuttal'] = "They are misunderstood creatures that reflect our own aggression. Treat them with respect, and they are loyal friends."
data['s11_objections__objection_02__objection'] = "I might get burned."
data['s11_objections__objection_02__rebuttal'] = "Safety gear and proper handling techniques significantly reduce risks. Plus, scars are cool."

# Advantage
data['s12_advantage__uvp_01'] = "Only course taught by Hiccup."
data['s12_advantage__comparison'] = "Others teach you to kill; we teach you to connect."
data['s12_advantage__innovation'] = "The first ever flight training program."

# Comms
data['s13_comms__tone'] = "Adventurous, encouraging, and respectful."
data['s13_comms__style'] = "Viking saga style mixed with practical instruction."
data['s13_comms__vibe'] = "Epic and heartwarming."

# Brand Style
data['r01_brand_style__colors__primary__name'] = "Night Fury Black"
data['r01_brand_style__colors__primary__hex'] = "#1a1a1a"
data['r01_brand_style__colors__secondary__name'] = "Plasma Blue"
data['r01_brand_style__colors__secondary__hex'] = "#0000ff"
data['r01_brand_style__colors__accent__name'] = "Fire Red"
data['r01_brand_style__colors__accent__hex'] = "#ff0000"

with open('data.json', 'w') as f:
    json.dump(data, f, indent=2)
print("data.json created successfully")
