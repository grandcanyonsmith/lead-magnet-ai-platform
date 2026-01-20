#!/usr/bin/env python3
"""
Download template HTML from S3, upload to new location with data.json, and return URLs.
"""
import argparse
import boto3
import json
import os
import uuid

def _normalize_prefix(prefix: str) -> str:
    normalized = (prefix or "").strip().lstrip("/")
    if normalized and not normalized.endswith("/"):
        normalized += "/"
    return normalized


parser = argparse.ArgumentParser(description="Upload report HTML + data.json to S3.")
parser.add_argument("--bucket", default=os.getenv("SHELL_S3_UPLOAD_BUCKET", "cc360-pages"))
parser.add_argument("--region", default=os.getenv("AWS_REGION", "us-west-2"))
parser.add_argument(
    "--tenant-id",
    default=os.getenv("TENANT_ID") or os.getenv("LM_TENANT_ID"),
)
parser.add_argument(
    "--job-id",
    default=os.getenv("JOB_ID") or os.getenv("LM_JOB_ID"),
)
parser.add_argument("--key-prefix", default=os.getenv("SHELL_S3_UPLOAD_KEY_PREFIX"))
parser.add_argument("--report-subdir", default=os.getenv("REPORT_SUBDIR", "market-research-reports-lead-magnents"))
args = parser.parse_args()

# Initialize S3 client
s3 = boto3.client('s3', region_name=args.region)
bucket_name = args.bucket

# Generate unique ID
unique_id = str(uuid.uuid4())
print(f"Generated unique ID: {unique_id}")

# Download the template HTML
source_key = 'templates/market-research-report/v4.html'
print(f"\n📥 Downloading {source_key}...")

try:
    response = s3.get_object(Bucket=bucket_name, Key=source_key)
    html_content = response['Body'].read().decode('utf-8')
    print(f"✅ Downloaded {len(html_content):,} bytes")
except Exception as e:
    print(f"❌ Error downloading: {e}")
    exit(1)

# Resolve upload prefix (keep within allowed leadmagnet/<tenant>/<job>/)
prefix_root = args.key_prefix
if not prefix_root:
    if args.tenant_id and args.job_id:
        prefix_root = f"leadmagnet/{args.tenant_id}/{args.job_id}/"
    else:
        prefix_root = "leadmagnet/"
prefix_root = _normalize_prefix(prefix_root)

report_subdir = (args.report_subdir or "").strip().strip("/")
if report_subdir:
    report_prefix = f"{prefix_root}{report_subdir}/{unique_id}/"
else:
    report_prefix = f"{prefix_root}{unique_id}/"

# Upload HTML to new location
html_key = f"{report_prefix}index.html"
print(f"\n📤 Uploading HTML to {html_key}...")

try:
    s3.put_object(
        Bucket=bucket_name,
        Key=html_key,
        Body=html_content.encode('utf-8'),
        ContentType='text/html'
    )
    html_url = f"https://{bucket_name}.s3.{args.region}.amazonaws.com/{html_key}"
    print(f"✅ Uploaded HTML successfully")
except Exception as e:
    print(f"❌ Error uploading HTML: {e}")
    exit(1)

# Prepare JSON data
json_data = {
    "meta__template_version": "1.0",
    "meta__brand_name": "Dragonflight Academy",
    "meta__last_updated": "2026-01-03",
    "s00_intro__core__title": "Who Is This Dragon Training Course For?",
    "s00_intro__core__description": "Ideal student profile and positioning guide for the How to Train Your Dragon curriculum.",
    "s01_story__core__title": "From Chaos to Wingmate",
    "s01_story__core__content": "For most new riders, the first time a dragon circles overhead is equal parts awe and terror. Villagers dive for cover, someone yells to grab the chains, and well\u2011meaning handlers shout conflicting commands until the dragon bolts or blasts a nervous flame into the sky.\n\nOur lead instructor started exactly there: chasing scorch marks, apologizing for collapsed carts, and wondering why every book insisted dragons could be loyal partners when the ones in front of them seemed unpredictable at best. Years of trial and error showed a painful pattern\u2014most training methods tried to overpower dragons instead of understanding how they naturally think, play, and learn.\n\nInstead of starting with domination, they shifted to a bond\u2011first approach: prepare a safe training ground, learn a dragon's body language and temperament, establish simple rituals of trust, then introduce clear cues in an order that matches the way young dragons explore the world. Small, consistent wins replaced dramatic showdowns. First came calm landings, then willing take\u2011offs, then confident arcs over the valley.\n\nHow to Train Your Dragon became an eight\u2011module curriculum that turns chaotic fire\u2011breathers into steady wingmates. The program gives riders cinematic lessons, illustrated field guides, printable training plans, and optional live support so they don't have to improvise alone. The goal is simple: fewer singed eyebrows, more legends built on real partnership.",
    "s02_offer__core__product_name": "How to Train Your Dragon (8-Module Rider Course)",
    "s02_offer__core__price": "$249",
    "s02_offer__core__investment_terms": "$249 USD; optional installment plan; 14-day satisfaction guarantee.",
    "s02_offer__core__short_description": "An 8-module, story-driven training program that teaches aspiring riders how to safely bond with, communicate with, and train a young dragon\u2014from first contact to confident flight.",
    "s02_offer__core__unique_mechanism_tagline": "Bond-First Dragon Training",
    "s02_offer__core__unique_mechanism_description": "A trust-centered training pathway that starts with safety and environment setup, then layers in temperament mapping, bonding rituals, and clear communication cues so dragons learn because they choose to, not because they are forced.",
    "s02_offer__core__delivery_format": "Self-paced online course with video lessons, cinematic demonstrations, illustrated field guides, and printable training plans; optional live Q&A flights with instructors.",
    "s02_offer__core__delivery_access": "Lifetime access to all modules and future updates; watch on desktop, tablet, or mobile.",
    "s02_offer__core__delivery_community": "Optional private riders' hangar with moderated discussion, training logs, and seasonal challenges for students who want camaraderie without pressure.",
    "s02_offer__core__delivery_advisory": "Fantasy training curriculum created for entertainment, storytelling, and roleplay; not real-world animal-handling advice or safety guidance.",
    "s02_offer__feature_01__title": "Stable, Skyfield, and Safety Foundations",
    "s02_offer__feature_01__description": "I set up a safe training ground, shared signals, and emergency plans so both my dragon and I know how to stay out of trouble from day one.",
    "s02_offer__feature_02__title": "Dragon Temperament Map",
    "s02_offer__feature_02__description": "I learn how different dragon types think, play, and protest so I can match my approach to a shy, curious, or stubborn dragon instead of guessing.",
    "s02_offer__feature_03__title": "First Contact and Bonding Rituals",
    "s02_offer__feature_03__description": "I follow step-by-step first-meeting scripts, feeding rituals, and trust games that turn my dragon from wary stranger into willing partner.",
    "s02_offer__feature_04__title": "Ground Drills Before First Flight",
    "s02_offer__feature_04__description": "I practice simple ground exercises that build response to basic cues so our first flight feels exciting, not like a runaway sky-cart.",
    "s02_offer__feature_05__title": "Fire, Claws, and Power Management",
    "s02_offer__feature_05__description": "I learn how to introduce fire practice, land near fragile things, and channel my dragon's strength so they can show off without burning down the village.",
    "s02_offer__feature_06__title": "Communication Cues and Signals",
    "s02_offer__feature_06__description": "I build a clear language of hand signs, whistle calls, and saddle signals so my dragon knows exactly what I'm asking even in heavy wind.",
    "s02_offer__feature_07__title": "Troubleshooting Common Problems",
    "s02_offer__feature_07__description": "I get checklists and decision trees for nipping, sulking, overexcited zoomies, and refusal to land so I know what to adjust instead of escalating.",
    "s02_offer__feature_08__title": "Aerial Maneuvers and Stunts",
    "s02_offer__feature_08__description": "I level up from straight-line flights to dives, tight turns, and formation flying\u2014with drills that protect my dragon's wings and confidence.",
    "s02_offer__feature_09__title": "Rider Fitness and Mindset",
    "s02_offer__feature_09__description": "I learn how to stay calm, focused, and physically ready so I do not transmit panic through the saddle when the sky gets wild.",
    "s02_offer__feature_10__title": "Campaigns, Quests, and Ongoing Growth",
    "s02_offer__feature_10__description": "I leave with quest templates and progression paths so our training turns into an unfolding story instead of fizzling after the first big victory.",
    "s03_pains__pain_01__title": "My dragon ignores me or does the opposite of what I ask",
    "s03_pains__pain_01__description": "I have a powerful dragon at my side, but when I give a cue they stare, snort, or take off in their own direction\u2014and I do not know how to turn chaos into cooperation.",
    "s03_pains__pain_01__quote_01": "I feel like my dragon has never even heard the commands I keep repeating.",
    "s03_pains__pain_01__quote_02": "Every flight feels like a negotiation with a flying thunderstorm.",
    "s03_pains__pain_01__quote_03": "I need a clear system that makes sense to both me and my dragon.",
    "s03_pains__pain_01__score": 90,
    "s03_pains__pain_02__title": "I am afraid of hurting my dragon or being hurt",
    "s03_pains__pain_02__description": "Between teeth, claws, wings, and fire, I worry that one wrong move could injure us, our friends, or half the training field. The fear keeps me from practicing consistently.",
    "s03_pains__pain_02__quote_01": "I want adventure, but I do not want anyone carried to the healer because I guessed wrong.",
    "s03_pains__pain_02__quote_02": "I tense up every time my dragon flares their wings near people or buildings.",
    "s03_pains__pain_02__quote_03": "I need safety rules that let us train boldly without being reckless.",
    "s03_pains__pain_02__score": 92,
    "s03_pains__pain_03__title": "Legends and random tips contradict each other",
    "s03_pains__pain_03__description": "Every village, book, and bard has an opinion about dragons. Some say never show fear; others say never raise your voice. I am drowning in mixed advice and still do not know what to do tomorrow.",
    "s03_pains__pain_03__quote_01": "I have collected scrolls and stories, but they do not add up to a plan.",
    "s03_pains__pain_03__quote_02": "My friends tell me to 'trust the bond' while also warning me about bite marks.",
    "s03_pains__pain_03__quote_03": "I want one coherent path instead of a bag of disconnected tricks.",
    "s03_pains__pain_03__score": 88,
    "s03_pains__pain_04__title": "The idea of our first real flight terrifies me",
    "s03_pains__pain_04__description": "Part of me dreams of slicing through clouds; another part pictures tumbling out of the sky because we skipped a step. The fear makes me delay, which only keeps both of us inexperienced.",
    "s03_pains__pain_04__quote_01": "I keep saying we will fly 'after a few more ground sessions' that never seem to be enough.",
    "s03_pains__pain_04__quote_02": "I worry that one panicked flinch in the air will undo months of bonding.",
    "s03_pains__pain_04__quote_03": "I need a ladder of milestones that makes first flight feel earned, not reckless.",
    "s03_pains__pain_04__score": 84,
    "s03_pains__pain_05__title": "Training stalls whenever life gets busy",
    "s03_pains__pain_05__description": "I start strong, then travel, work, or other quests pull me away. By the time I return to the stable, my dragon's habits have slipped and I feel like we are starting over again.",
    "s03_pains__pain_05__quote_01": "Every break in practice feels like erasing a chapter of our story.",
    "s03_pains__pain_05__quote_02": "I need a simple routine that fits into real life, not just training montages.",
    "s03_pains__pain_05__quote_03": "I wish I had a way to keep progress from vanishing between sessions.",
    "s03_pains__pain_05__score": 86,
    "s03_pains__pain_06__title": "I do not know what is 'normal' dragon behavior",
    "s03_pains__pain_06__description": "Sometimes my dragon is playful, sometimes moody, sometimes distant. I cannot tell the difference between a harmless sulk and a serious warning sign\u2014and that uncertainty makes every interaction feel high stakes.",
    "s03_pains__pain_06__quote_01": "Is this a tantrum, a boundary, or a sign my dragon is unwell?",
    "s03_pains__pain_06__quote_02": "I wish I could read tail, wing, and eye signals as clearly as words.",
    "s03_pains__pain_06__quote_03": "I want a simple guide to what most dragons do when they are curious, stressed, or content.",
    "s03_pains__pain_06__score": 80,
    "s03_pains__pain_07__title": "My friends do not really get why I care this much",
    "s03_pains__pain_07__description": "People around me think dragons are a fun spectacle, not a serious partnership. When I talk about training plans or saddle fit, they glaze over or crack jokes, which makes me feel overly intense or alone.",
    "s03_pains__pain_07__quote_01": "I want people who understand why I would rather be at the aeries than at the tavern.",
    "s03_pains__pain_07__quote_02": "I feel silly geeking out about flight formations when no one else seems to care.",
    "s03_pains__pain_07__quote_03": "I need a place where talking dragon strategy is normal, not 'too much'.",
    "s03_pains__pain_07__score": 78,
    "s03_pains__pain_08__title": "Most resources stop at cute tricks",
    "s03_pains__pain_08__description": "I can find plenty of tips for basic commands and crowd-pleasing stunts, but almost nothing on long-term progression, serious quests, or balancing a dragon partnership with the rest of my life.",
    "s03_pains__pain_08__quote_01": "I want guidance that goes beyond 'how to get your dragon to roll over.'",
    "s03_pains__pain_08__quote_02": "I am ready for campaigns and responsibilities, not just parlor tricks.",
    "s03_pains__pain_08__quote_03": "I wish someone would teach the advanced path, not just the beginner gloss.",
    "s03_pains__pain_08__score": 82,
    "s03_pains__pain_09__title": "Gear, saddles, and signals all feel confusing",
    "s03_pains__pain_09__description": "Between harness styles, signal systems, and flight leathers, I am overwhelmed by choices and worried I will invest in the wrong setup for my dragon's body and temperament.",
    "s03_pains__pain_09__quote_01": "I keep staring at gear catalogs and closing them without deciding.",
    "s03_pains__pain_09__quote_02": "I am not sure which pieces are essential and which are just shiny.",
    "s03_pains__pain_09__quote_03": "I want clear recommendations that match specific dragon types and training stages.",
    "s03_pains__pain_09__score": 76,
    "s03_pains__pain_10__title": "I want a framework I can also use to help other riders",
    "s03_pains__pain_10__description": "I mentor younger riders or run a small stable, but I am improvising. I want a clear framework I can teach that keeps dragons and humans safe while still leaving room for each pair's unique bond.",
    "s03_pains__pain_10__quote_01": "I am the one everyone asks for help, and I want tools worthy of that trust.",
    "s03_pains__pain_10__quote_02": "I need guidance on when to push, when to pause, and when to call in more experienced riders.",
    "s03_pains__pain_10__quote_03": "I want a model that scales from my own dragon to an entire rookery.",
    "s03_pains__pain_10__score": 79,
    "s04_desires__desire_01__title": "To build an unshakable bond with my dragon",
    "s04_desires__desire_01__vision_snapshot": "I move through the training grounds with quiet confidence because my dragon tracks my voice, posture, and signals like we are already mid-flight.",
    "s04_desires__desire_01__tangible_milestones": "We complete the bonding rituals, master calm mounting and landing, and log 30, 60, and 90 days of consistent practice without major setbacks.",
    "s04_desires__desire_01__emotional_win": "I feel grounded and proud knowing my dragon chooses to stay by my side, not because of chains but because of trust.",
    "s04_desires__desire_01__quote_01": "I want to be the one rider my dragon looks for in a crowded skyfield.",
    "s04_desires__desire_01__quote_02": "I care more about our bond than about flashy stunts.",
    "s04_desires__desire_01__quote_03": "I crave the ease of moving as one creature in the air.",
    "s04_desires__desire_02__title": "To understand dragon instincts in plain language",
    "s04_desires__desire_02__vision_snapshot": "I can glance at wing angle, tail motion, and eye shape and instantly tell whether my dragon is playful, cautious, annoyed, or done for the day.",
    "s04_desires__desire_02__tangible_milestones": "I complete the temperament map, identify my dragon's primary and secondary styles, and track their usual responses across different environments.",
    "s04_desires__desire_02__emotional_win": "I feel calm because behavior that used to confuse me now fits a pattern I know how to respond to.",
    "s04_desires__desire_02__quote_01": "I want to stop guessing what my dragon is feeling.",
    "s04_desires__desire_02__quote_02": "I love having names for the signals I used to miss.",
    "s04_desires__desire_02__quote_03": "I am ready to read my dragon as clearly as any map.",
    "s04_desires__desire_03__title": "To fly confidently in real missions, not just practice laps",
    "s04_desires__desire_03__vision_snapshot": "We complete supply runs, scouting flights, and celebration flyovers with reliability, even when conditions are less than perfect.",
    "s04_desires__desire_03__tangible_milestones": "We check off first solo flight, first night flight, first long-distance route, and first mission with other riders without major incidents.",
    "s04_desires__desire_03__emotional_win": "I feel capable and useful, not just like someone rehearsing tricks in an empty field.",
    "s04_desires__desire_03__quote_01": "I want our training to matter in actual quests and campaigns.",
    "s04_desires__desire_03__quote_02": "I am excited by the idea of being trusted with real responsibilities.",
    "s04_desires__desire_03__quote_03": "I picture us as part of a squadron, not just a spectacle.",
    "s04_desires__desire_04__title": "To make training fun for both of us",
    "s04_desires__desire_04__vision_snapshot": "Our sessions feel like games and adventures my dragon looks forward to instead of chores I have to drag us through.",
    "s04_desires__desire_04__tangible_milestones": "We rotate through structured drills, play-based challenges, and quest-style campaigns that keep motivation high without losing safety.",
    "s04_desires__desire_04__emotional_win": "I feel delighted watching my dragon's enthusiasm grow as they master new skills.",
    "s04_desires__desire_04__quote_01": "I want a training plan that feels like story time, not homework.",
    "s04_desires__desire_04__quote_02": "I learn best when there is a bit of magic and play involved.",
    "s04_desires__desire_04__quote_03": "I love the idea of unlocking new abilities together like a co-op game.",
    "s04_desires__desire_05__title": "To turn my dragon passion into a lasting craft",
    "s04_desires__desire_05__vision_snapshot": "I am known in my circles as the rider who brings structure, creativity, and care to every dragon partnership they touch.",
    "s04_desires__desire_05__tangible_milestones": "I complete the full curriculum, document our training journey, and optionally mentor at least one new rider or integrate the system into my stories, campaigns, or community events.",
    "s04_desires__desire_05__emotional_win": "I feel fulfilled because my love for dragons is not just a private obsession\u2014it becomes something that builds worlds and helps others.",
    "s04_desires__desire_05__quote_01": "I want my dragon knowledge to count for something beyond my own stable.",
    "s04_desires__desire_05__quote_02": "I am excited by the idea of being the 'dragon person' in my community.",
    "s04_desires__desire_05__quote_03": "I would love to look back and see a legacy of riders and stories we helped shape.",
    "s05_authority__core__title": "Veteran riders, stable masters, and worldbuilders with decades of combined dragon-handling experience",
    "s05_authority__historical_01": "Lead instructor has spent over 15 years designing dragon-training systems for tabletop campaigns, live roleplay events, and fantasy fiction worlds.",
    "s05_authority__historical_02": "Has guided hundreds of players and readers through building believable dragon-human partnerships that balance wonder with responsibility.",
    "s05_authority__historical_03": "Served as head trainer for a long-running fantasy roleplay community, coordinating multi-year story arcs centered on dragon bonds.",
    "s05_authority__historical_04": "Consulted on game mechanics and narrative design for independent studios building dragon-focused adventures.",
    "s05_authority__historical_05": "Regularly teaches workshops on creature behavior, worldbuilding, and safe, collaborative storytelling.",
    "s05_authority__credentials_01": "Creator of the Bond-First Dragon Training framework used by multiple online communities and campaigns.",
    "s05_authority__credentials_02": "Host of an ongoing dragon-training actual-play series that demonstrates the curriculum in action.",
    "s05_authority__credentials_03": "Recognized by fantasy communities for clear teaching style, safety-conscious guidelines, and imaginative yet grounded lore.",
    "s06_competitors__competitor_01__name": "SkyRider Academy",
    "s06_competitors__competitor_01__offering": "Video course library focused on aerial maneuvers and stunt flying with dragons",
    "s06_competitors__competitor_01__usp": "High-adrenaline flight sequences and performance-focused drills",
    "s06_competitors__competitor_01__pricing": "$150-$300 one-time courses",
    "s06_competitors__competitor_01__website": "https://www.skyrider-academy.com/",
    "s06_competitors__competitor_02__name": "Wyvern Whisperers",
    "s06_competitors__competitor_02__offering": "Short workshops on reading dragon body language and calming anxious wyverns",
    "s06_competitors__competitor_02__usp": "Niche focus on sensitive and rescue dragons",
    "s06_competitors__competitor_02__pricing": "$40-$90 per workshop",
    "s06_competitors__competitor_02__website": "https://www.wyvernwhisperers.com/",
    "s06_competitors__competitor_03__name": "Dragon Taming 101 App",
    "s06_competitors__competitor_03__offering": "Mobile app with bite-sized tips, daily prompts, and mini-games about dragon care",
    "s06_competitors__competitor_03__usp": "Casual, gamified approach suitable for younger riders and families",
    "s06_competitors__competitor_03__pricing": "$5-$15/month subscription",
    "s06_competitors__competitor_03__website": "https://www.dragontaming101.app/",
    "s06_competitors__competitor_04__name": "Academy of Legendary Beasts",
    "s06_competitors__competitor_04__offering": "Broader creature-handling curriculum with a single module on dragons",
    "s06_competitors__competitor_04__usp": "Covers multiple fantasy creatures for generalist handlers",
    "s06_competitors__competitor_04__pricing": "$300-$500 for full bundle",
    "s06_competitors__competitor_04__website": "https://www.legendarybeastsacademy.com/",
    "s06_competitors_indirect__competitor_01__name": "General fantasy writing courses",
    "s06_competitors_indirect__competitor_01__problem": "Teach worldbuilding and character arcs without specific tools for believable dragon-human partnerships",
    "s06_competitors_indirect__competitor_01__overlap": "Overlap for writers who want better dragon stories but start with generic craft programs instead of creature-focused training",
    "s06_competitors_indirect__competitor_01__website": "https://www.udemy.com/topic/creative-writing/",
    "s06_competitors_indirect__competitor_02__name": "Tabletop roleplaying rulebooks",
    "s06_competitors_indirect__competitor_02__problem": "Provide stats and spells but little guidance on long-term dragon bonding or training sequences",
    "s06_competitors_indirect__competitor_02__overlap": "Game masters and players rely on core books for inspiration instead of structured dragon-training frameworks",
    "s06_competitors_indirect__competitor_02__website": "https://dnd.wizards.com/",
    "s06_competitors_indirect__competitor_03__name": "Creature-handling and horsemanship channels",
    "s06_competitors_indirect__competitor_03__problem": "Offer real-world training inspiration but do not translate directly into dragon-scale power, flight, or fire",
    "s06_competitors_indirect__competitor_03__overlap": "Riders borrow techniques from animal trainers when they cannot find dragon-specific resources",
    "s06_competitors_indirect__competitor_03__website": "https://www.youtube.com/results?search_query=horsemanship+training",
    "s06_competitors_influencers__influencer_01__name": "Fantasy worldbuilding channels on YouTube",
    "s06_competitors_influencers__influencer_01__url": "https://www.youtube.com/results?search_query=fantasy+worldbuilding",
    "s06_competitors_influencers__influencer_02__name": "Actual-play streams featuring dragon companions",
    "s06_competitors_influencers__influencer_02__url": "https://www.youtube.com/results?search_query=actual+play+dragons",
    "s06_competitors_influencers__influencer_03__name": "Fantasy authors known for dragon-human bonds",
    "s06_competitors_influencers__influencer_03__url": "https://www.goodreads.com/list/show/6.Dragons_in_Fantasy",
    "s06_competitors_influencers__influencer_04__name": "Game designers who specialize in creature companions",
    "s06_competitors_influencers__influencer_04__url": "https://www.gdcvault.com/",
    "s07_audience__demographics__age": "18-45 years old (core 20-35)",
    "s07_audience__demographics__gender": "Mixed; inclusive of all genders, with a slight skew toward people who already identify strongly with fantasy heroes and caretakers",
    "s07_audience__demographics__income": "$35,000-$120,000/year",
    "s07_audience__demographics__education": "From self-taught creatives to graduate degrees; many are avid readers, gamers, or storytellers",
    "s07_audience__demographics__occupation": "Students, creative professionals, educators, tech and knowledge workers, game masters, and hobbyist writers",
    "s07_audience__demographics__family": "Single adventurers, partnered riders, and families who enjoy shared fantasy worlds",
    "s07_audience__demographics__location": "Primarily North America and Europe, with dragon enthusiasts across English-speaking regions worldwide",
    "s07_audience__values_01": "I believe powerful creatures deserve respect, not fear or exploitation.",
    "s07_audience__values_02": "I value imagination and play, but I also care about structure and safety.",
    "s07_audience__values_03": "I believe long-term bonds are built through small, consistent actions\u2014not dramatic gestures.",
    "s07_audience__values_04": "I think good stories balance awe, responsibility, and ethical choices.",
    "s07_audience__values_05": "I believe communities are stronger when everyone has clear roles and shared language.",
    "s07_audience__interests_01": "I read fantasy novels and watch shows where dragons and creature companions feel like real characters.",
    "s07_audience__interests_02": "I play tabletop or video games that let me bond with mounts, pets, or magical beasts.",
    "s07_audience__interests_03": "I love building worlds, campaigns, or stories and want my dragon lore to feel coherent.",
    "s07_audience__interests_04": "I look for online communities where it is normal to discuss flight patterns, training plans, and creature behavior.",
    "s07_audience__interests_05": "I enjoy learning systems\u2014whether in games, crafts, or skills\u2014that turn raw potential into mastery.",
    "s08_values__synthesis": "If you asked me what I stand for, I would say: 'I want adventures that honor powerful creatures, deepen trust, and build worlds I am proud to inhabit\u2014without cruelty, shortcuts, or throwaway stories.'",
    "s08_values__value_01__name": "Imagination",
    "s08_values__value_01__explanation": "I love worlds where dragons soar over cities and mountains, and I want my training and storytelling to feel worthy of that scale.",
    "s08_values__value_02__name": "Responsibility",
    "s08_values__value_02__explanation": "I know that power without care is dangerous, so I value frameworks that keep both dragons and riders safe.",
    "s08_values__value_03__name": "Courage",
    "s08_values__value_03__explanation": "I am willing to step into the arena, face big challenges, and learn from mistakes as long as I am not doing it alone.",
    "s08_values__value_04__name": "Respect for Creatures",
    "s08_values__value_04__explanation": "I want dragons to be treated as partners with their own instincts and boundaries, not as props.",
    "s08_values__value_05__name": "Community",
    "s08_values__value_05__explanation": "I believe the best stories and skills grow in groups that share knowledge, celebrate wins, and protect each other.",
    "s08_values__value_06__name": "Mastery",
    "s08_values__value_06__explanation": "I like seeing visible progress\u2014from wobbly takeoffs to smooth formations\u2014and I am willing to practice to get there.",
    "s08_values__value_07__name": "Play",
    "s08_values__value_07__explanation": "I take my craft seriously but still want room for games, jokes, and joy with my dragon.",
    "s09_transformation__before": "Before finding this course, I had a dragon I adored but no reliable way to guide them. Training sessions felt chaotic, first-flight dreams stayed on the ground, and most advice I found was either too vague or focused only on flashy tricks.",
    "s09_transformation__after": "Now I have a clear, bond-first system for setting up our environment, reading my dragon's signals, and progressing from ground work to confident flights and real missions.",
    "s09_transformation__emotional_shift": "I have shifted from nervous, inconsistent dabbler to steady rider who trusts both my dragon and my own decisions.",
    "s09_transformation__impact": "This transformation has given me back my sense of wonder and agency. Instead of worrying what might go wrong every time my dragon spreads their wings, I have step-by-step plans that turn raw power into shared adventures.",
    "s10_media__social_01__name": "Discord fantasy servers",
    "s10_media__social_01__url": "https://discord.com/",
    "s10_media__social_02__name": "YouTube actual-play and lore channels",
    "s10_media__social_02__url": "https://www.youtube.com/",
    "s10_media__social_03__name": "Reddit fantasy communities",
    "s10_media__social_03__url": "https://www.reddit.com/r/fantasy/",
    "s10_media__social_04__name": "Instagram and TikTok cosplay and art accounts",
    "s10_media__social_04__url": "https://www.instagram.com/",
    "s10_media__podcasts_01__name": "Writing Excuses",
    "s10_media__podcasts_01__url": "https://writingexcuses.com/",
    "s10_media__podcasts_02__name": "Dragon Talk (D&D podcast)",
    "s10_media__podcasts_02__url": "https://dnd.wizards.com/dragon-talk",
    "s10_media__podcasts_03__name": "Critical Role and other actual-play shows",
    "s10_media__podcasts_03__url": "https://critrole.com/",
    "s10_media__blogs_01__name": "Tor.com fantasy blog",
    "s10_media__blogs_01__url": "https://www.tor.com/",
    "s10_media__blogs_02__name": "r/worldbuilding resources and essays",
    "s10_media__blogs_02__url": "https://www.reddit.com/r/worldbuilding/",
    "s10_media__blogs_03__name": "Fantasy cartography and mapmaking blogs",
    "s10_media__blogs_03__url": "https://www.cartographersguild.com/",
    "s10_media__books_01__title": "Eragon",
    "s10_media__books_01__author": "Christopher Paolini",
    "s10_media__books_01__url": "https://www.amazon.com/dp/0375826696",
    "s10_media__books_02__title": "His Majesty's Dragon",
    "s10_media__books_02__author": "Naomi Novik",
    "s10_media__books_02__url": "https://www.amazon.com/dp/0345481283",
    "s10_media__books_03__title": "Dragonriders of Pern",
    "s10_media__books_03__author": "Anne McCaffrey",
    "s10_media__books_03__url": "https://www.amazon.com/dp/0345481879",
    "s10_media__forums_01__name": "Reddit: r/dragonriders (fan communities around dragon bonds)",
    "s10_media__forums_01__url": "https://www.reddit.com/search/?q=dragonrider",
    "s10_media__forums_02__name": "Tabletop RPG forums and Discords",
    "s10_media__forums_02__url": "https://www.reddit.com/r/rpg/",
    "s11_objections__objection_01__objection": "I do not have time to commit to an epic training saga",
    "s11_objections__objection_01__rebuttal": "The course is broken into short, focused modules with clear checklists. You can complete meaningful steps in 20\u201330 minutes a week and still see steady progress with your dragon.",
    "s11_objections__objection_02__objection": "I can find dragon tips for free online",
    "s11_objections__objection_02__rebuttal": "Random tips and forum threads rarely add up to a complete progression. This curriculum gives you one coherent, bond-first framework\u2014from first contact to advanced missions\u2014so you are not stitching it together alone.",
    "s11_objections__objection_03__objection": "The price feels high for a fantasy course",
    "s11_objections__objection_03__rebuttal": "You are not just buying lore; you are getting a reusable system you can apply to multiple dragons, campaigns, and stories. Lifetime access and an installment plan help spread the investment over time.",
    "s11_objections__objection_04__objection": "I am new to dragons and worry I will be left behind",
    "s11_objections__objection_04__rebuttal": "The training path assumes no prior experience. Early modules focus on safety, temperament, and simple rituals, with optional challenges for more seasoned riders so everyone can move at the right pace.",
    "s11_objections__objection_05__objection": "My world, game, or story has different rules for dragons",
    "s11_objections__objection_05__rebuttal": "The framework is designed to be adaptable. You will learn core principles of bonding, communication, and progression that you can reskin for your setting, whether your dragons breathe fire, lightning, or song.",
    "s11_objections__objection_06__objection": "My friends already think I am too obsessed with dragons",
    "s11_objections__objection_06__rebuttal": "Inside the academy, your enthusiasm is normal. You can learn privately at your own pace and join community spaces only if and when you want camaraderie with people who share your passion.",
    "s12_advantage__uvp_01": "Only structured curriculum that treats dragon training as a complete progression\u2014from first contact to squadron missions\u2014rather than a handful of tricks.",
    "s12_advantage__uvp_02": "Bond-first methodology that prioritizes safety, trust, and communication before stunts and spectacle.",
    "s12_advantage__uvp_03": "Designed to plug into stories, campaigns, and roleplay\u2014not just standalone lessons.",
    "s12_advantage__uvp_04": "Clear guidance for both solo riders and mentors who support an entire rookery or player group.",
    "s12_advantage__uvp_05": "Rich, reusable resources: printable field guides, quest templates, and example missions you can adapt again and again.",
    "s12_advantage__comparison": "Unlike resources that toss you random dragon facts or a few cinematic stunts, this course walks you through a complete, bond-first training arc with safety guidelines, progression checklists, and story-friendly missions.",
    "s12_advantage__innovation": "We combine temperament mapping, trust rituals, and mission-based progression into one coherent framework that works for writers, game masters, and in-world riders alike.",
    "s13_comms__tone": "Adventurous, encouraging, and steady\u2014like a seasoned rider talking you through saddling up for the first time.",
    "s13_comms__style": "Plain language, vivid examples, and step-by-step instructions; mixes in-world flavor with clear, practical guidance.",
    "s13_comms__vibe": "Epic but grounded: celebrates wonder while keeping a firm grip on safety, consent, and mutual respect between rider and dragon.",
    "s13_comms__avoid_01": "Grim, brutal depictions of dragons as mindless weapons.",
    "s13_comms__avoid_02": "Overly technical rule jargon without story context.",
    "s13_comms__avoid_03": "Shaming riders for being nervous, new, or deeply enthusiastic.",
    "s13_comms__avoid_04": "Glorifying reckless stunts that ignore safety groundwork.",
    "s13_comms__avoid_05": "Gatekeeping attitudes that say only certain types of fans or players count as 'real' riders."
}

# Upload JSON file
json_key = f"{report_prefix}data.json"
print(f"\n📤 Uploading JSON to {json_key}...")

try:
    s3.put_object(
        Bucket=bucket_name,
        Key=json_key,
        Body=json.dumps(json_data, indent=2).encode('utf-8'),
        ContentType='application/json'
    )
    json_url = f"https://{bucket_name}.s3.{args.region}.amazonaws.com/{json_key}"
    print(f"✅ Uploaded JSON successfully")
except Exception as e:
    print(f"❌ Error uploading JSON: {e}")
    exit(1)

# Print results
print("\n" + "="*80)
print("✅ Upload Complete!")
print("="*80)
print(f"\n📁 Folder: {report_prefix}")
print(f"\n📄 HTML File:")
print(f"   URL: {html_url}")
print(f"\n📄 JSON File:")
print(f"   URL: {json_url}")
print(f"\n🎯 HTML Object URL (for your use):")
print(f"   {html_url}")
