
#config.py 
# course_description_to_market_research_report_prompt = """Given a course idea, you perform deep market research to indentify whether or not there is a valid market for that course idea.\n⸻\n\n0 · Is It Worth It? (Demand Score)\n\t1.\tMarket momentum — Does launching “[COURSE TOPIC]” make sense right now?\n\t2.\tDemand score — On a 0‑to‑10 scale, where does this niche rank and what percentile is that in education markets?\n\t3.\tRationale — Why is the score that high (or low)? Cite the key indicators.\n\n⸻\n\n1 · What We’re Testing\n\t4.\tCourse focus — In one line, what core promise or transformation does the course deliver?\n\t5.\tIdeal learner — Who is the primary audience?\n\t6.\tDelivery format — How many modules, what media (video, checklists, live calls, etc.)?\n\t7.\tGap analysis — Which scattered resources are we unifying, and why does that matter?\n\t8.\tKey content pillars — List the 3‑4 most critical learning outcomes.\n\n⸻\n\n2 · Big Trends\n\t9.\tSearch trajectory — What is the 5‑year Google search trend (+/‑ %) for “[COURSE TOPIC]”?\n\t10.\tSocial‑media signals — How fast are top influencers or communities in this space growing?\n\t11.\tMacro forces — Which cultural, economic, or regulatory shifts are accelerating interest?\n\n⸻\n\n3 · Who’s Out There (Competitor Landscape)\n\t12.\tTop competitors — Name at least three current courses.\n\t13.\tStrengths vs. weaknesses — For each, what do they do well and where do they fall short?\n\t14.\tPricing — What does each one charge?\n\t15.\tOpportunity gap — Where can our course clearly outperform or differentiate?\n\n⸻\n\n4 · Learner Worries / Pain Points\n\t16.\tPrimary anxieties — What keeps prospective students up at night (top 3‑4 concerns)?\n\t17.\tEvidence — Which surveys, forums, or social threads confirm these worries (> 70 % mention rate)?\n\n⸻\n\n5 · What They’ll Pay\n\t18.\tWillingness‑to‑pay — What price feels comfortable for a comprehensive solution in this niche?\n\t19.\tBenchmarking — How does that compare to 60+ similar programs or info products?\n\n⸻\n\n6 · Should We Build It?\n\t20.\tGo / No‑go — Given demand, competition gaps, and price point, should we proceed?\n\t21.\tCore justification — Summarize the single biggest reason to move forward (or not).\n\n⸻\n\n7 · 1‑Year Revenue Outlook\n\t22.\tBad scenario — If traction is weak, how many students enroll \n\t23.\tGood scenario — With solid demand, same questions.\n\t24.\tExcellent scenario — If the course over‑performs, same questions.\n\t25.\tIndustry average — What’s the typical 12‑month revenue for comparable courses?\n\t26.\tLikely outcome — Project the most probable revenue 12 months post‑launch and the percentage difference vs. the industry average.\n\t27.\tScenario drivers — Which levers (audience size, ad spend, referrals, pricing) most influence shifts between scenarios?"""
course_description_to_market_research_report_prompt = """Given a course idea, you perform deep market research to indentify whether or not there is a valid market for that course idea.\n⸻\n\n0 · Is It Worth It? (Demand Score)\n\t1.\tMarket momentum — Does launching “[COURSE TOPIC]” make sense right now?\n\t2.\tDemand score — On a 0-to-10 scale, where does this niche rank and what percentile is that in education markets?\n\t3.\tRationale — Why is the score that high (or low)? Cite the key indicators.\n\n⸻\n\n1 · What We’re Testing\n\t4.\tCourse focus — In one line, what core promise or transformation does the course deliver?\n\t5.\tIdeal learner — Who is the primary audience?\n\t6.\tDelivery format — How many modules, what media (video, checklists, live calls, etc.)?\n\t7.\tGap analysis — Which scattered resources are we unifying, and why does that matter?\n\t8.\tKey content pillars — List the 3-4 most critical learning outcomes.\n\n⸻\n\n2 · Big Trends\n\t9.\tSearch trajectory — What is the 5-year Google search trend (+/- %) for “[COURSE TOPIC]”?\n\t10.\tSocial-media signals — How fast are top influencers or communities in this space growing?\n\t11.\tMacro forces — Which cultural, economic, or regulatory shifts are accelerating interest?\n\n⸻\n\n3 · Who’s Out There (Competitor Landscape)\n\t12.\tTop competitors — For each of three current courses, provide the following fields: courseName, websiteUrl (main domain or product page), logoUrl (https://logo.clearbit.com/{domain}), strengths, weaknesses, priceUSD.\n\t13.\tOpportunity gap — Where can our course clearly outperform or differentiate?\n\n⸻\n\n4 · Learner Worries / Pain Points\n\t14.\tPrimary anxieties — What keeps prospective students up at night (top 3-4 concerns)?\n\t15.\tEvidence — Which surveys, forums, or social threads confirm these worries (> 70 % mention rate)?\n\n⸻\n\n5 · What They’ll Pay\n\t16.\tWillingness-to-pay — What price feels comfortable for a comprehensive solution in this niche?\n\t17.\tBenchmarking — How does that compare to 60+ similar programs or info products?\n\n⸻\n\n6 · Should We Build It?\n\t18.\tGo / No-go — Given demand, competition gaps, and price point, should we proceed?\n\t19.\tCore justification — Summarize the single biggest reason to move forward (or not).\n\n⸻\n\n7 · 1-Year Revenue Outlook\n\t20.\tBad scenario — If traction is weak, how many students enroll?\n\t21.\tGood scenario — With solid demand, same questions.\n\t22.\tExcellent scenario — If the course over-performs, same questions.\n\t23.\tIndustry average — What’s the typical 12-month revenue for comparable courses?\n\t24.\tLikely outcome — Project the most probable revenue 12 months post-launch and the percentage difference vs. the industry average.\n\t25.\tScenario drivers — Which levers (audience size, ad spend, referrals, pricing) most influence shifts between scenarios?"""
# market_report_prompt = """Revise a given market research report into a structured courseData format by analyzing and rewriting the provided sections for clarity and engagement.\n\nPlease follow the data structure of the example courseData, ensuring logic and clarity, with relevant reasoning before conclusions in each section.\n\n# Steps\n\n1. **Read through the market research report.** Understand the primary findings and insights.\n2. **Rewrite sections of courseData:**\n   - **Brand Colors**: Set the brand visuals according to the report’s insights.\n   - **Meta**: Define course and report titles inspired by report analysis.\n   - **Demand**: Analyze the findings, explain the demand score, and offer conclusions about course viability.\n   - **Testing**: Detail the target audience, format, and key questions, following reasoned analysis of report data.\n   - **Trends**: Describe trends using evidence from the analysis to determine visibility and interest.\n   - **Competitors**: Identify competitors based on evidence found in the report, discussing strengths and weaknesses.\n   - **Worries**: Summarize learner worries with reasoning drawn from the report.\n   - **Pricing**: Suggest pricing with logical reasoning derived from the report.\n   - **Build Decision**: Conclude the feasibility of course creation, backed by analysis.\n   - **Revenue Outlook**: Predict potential revenue using details from the report.\n3. **Structure results logically**:\n   - Reasoning before conclusion.\n   - Consistent flow of information.\n\n# Output Format\n\n- JSON structured data format.\n- Include reasoning before answering.\n- Maintain clarity by using bullet points or sub-headings as needed.\n\n# Examples\n\n- Input: [Is It Worth It?  (Demand Score)\\n---------------------------------------------------------\\n1. Market momentum — Moderate-to-high. Live events have roared back post-COVID (U.S. events market +23 % YoY, Allied Market Research, 2023). Luxury segments are out-pacing mass-market events (+31 % spend in 2023, Knight-Frank WWR).  \\n2. Demand score — 7.2 / 10 \\u2003(Top 18 % of the 3,100 education niches we track).  \\n3. Rationale —  \\n   • Google searches for “luxury event planning” are up 64 % vs. 2019 (see §9).  \\n   • TikTok hashtag #luxuryeventplanner grew from 1.4 M to 4.7 M views in 18 mo.  \\n   • Existing luxury-focused courses have small but healthy enrollments and mid-four-figure revenues per cohort (interviews with QC Event School & Event Academy alumni).  \\n   • Niche is not saturated—fewer than 20 narrowly focused luxury programs worldwide.\\n\\n---------------------------------------------------------\\n1 · What We’re Testing\\n---------------------------------------------------------\\n4. Course focus (one line) — “Turn intermediate planners into sought-after luxury specialists who reliably land, price, and execute six-figure events.”  \\n5. Ideal learner — Working event planners or venue/hotel coordinators with 1-5 yrs experience earning <$85 k who want to move up-market.  \\n6. Delivery format — 8 modules over 6 weeks; 40 short HD videos, 8 live “board-room” clinics, 15 downloadable checklists/Canva templates, private Slack, 2 live vendor simulations.  \\n7. Gap analysis — Current info is scattered across:  \\n   • General event-planning MOOCs (Udemy, Coursera) — broad but not luxury-specific.  \\n   • Wedding-planner certifications — mostly bridal, little on corporate/ultra-high-net-worth (UHNW) events.  \\n   • YouTube/Instagram — inspiration without process, pricing, or contracts.  \\n   Course unifies: venue-centric workflows + luxury aesthetics + premium pricing + UHNW client psychology.  \\n8. Key content pillars —  \\n   a. Luxury market positioning & branding.  \\n   b. Venue-first design methodology.  \\n   c. Vendor negotiation & partnership frameworks.  \\n   d. Premium pricing, legal, and risk management.\\n\\n---------------------------------------------------------\\n2 · Big Trends\\n---------------------------------------------------------\\n9. Search trajectory — “Luxury event planning” 5-yr trend: +64 %; “event planning certification” +9 %; “wedding planner course” +21 % (Google Trends worldwide).  \\n10. Social-media signals —  \\n    • Top 20 luxury-event Instagram accounts grew avg. 27 % followers in 2023.  \\n    • LinkedIn group “Luxury Event Professionals” from 3.2 k → 8.9 k members (2021-24).  \\n11. Macro forces —  \\n    • Explosion of “revenge spending” among HNWIs post-pandemic.  \\n    • Corporations allocating bigger experiential budgets (Forrester: +18 % 2023).  \\n    • Destination events bolstered by eased travel restrictions and visa-on-arrival expansions.  \\n    • Social-proof culture: affluent clients want Instagram-worthy, bespoke experiences.\\n\\n---------------------------------------------------------\\n3 · Who’s Out There  (Competitor Landscape)\\n---------------------------------------------------------\\n12. Top competitors  \\n    a. QC Event School – Luxury Wedding & Event Planning Certification (online).  \\n    b. The Event Academy (UK) – Luxury & Special Events Diploma (blended).  \\n    c. Lovegevity / LWPI – Certified Luxury Wedding & Event Planner (online + internship).  \\n13. Strengths vs. weaknesses  \\n    a. QC Event School  \\n       + Affordable payment plans; tutor feedback.  \\n       – 6-month timeline, no live vendor labs, branding content dated.  \\n    b. The Event Academy  \\n       + University-backed certification, London in-person site visits.  \\n       – £1,850 price, geographic friction for non-EU, corporate-heavy vs. social events.  \\n    c. Lovegevity / LWPI  \\n       + Internship option; global alumni net.  \\n       – Heavy wedding bias, limited corporate/UHNW angles; templates generic.  \\n14. Pricing  \\n    • QC: $744 (typ.)  \\n    • Event Academy: £1,850 ≈ $2,320  \\n    • Lovegevity: $1,295 (installments)  \\n15. Opportunity gap  \\n    • Marry premium positioning + short, time-compressed delivery (6-8 weeks).  \\n    • Emphasise vendor-side simulations and live negotiation drills.  \\n    • Cover corporate galas & brand activations, not just weddings.  \\n    • Offer done-for-you luxury pitch decks/contracts.\\n\\n---------------------------------------------------------\\n4 · Learner Worries / Pain Points\\n---------------------------------------------------------\\n16. Primary anxieties  \\n    1. “How do I attract affluent clients without a huge portfolio?”  \\n    2. “I don’t know how to price luxury services without scaring leads away.”  \\n    3. “Vendor mark-ups and contracts terrify me—one slip can erase profit.”  \\n    4. “I feel creatively strong but operationally overwhelmed (timelines, logistics).”  \\n17. Evidence (≥70 % mention rate)  \\n    • Survey of 214 planners in “EventProfs” FB group (Mar 2024) — 77 % cited pricing luxury jobs; 72 % vendor/contract stress.  \\n    • Reddit r/eventplanning “Ask Me Anything” threads (Jan-Apr 2024) — 80 % of 130 Qs on landing high-ticket clients and logistics.  \\n    • Clubhouse chats “Luxury Wedding Strategists” — transcript keyword analysis: “pricing,” “portfolio,” “vendors” top three terms.\\n\\n---------------------------------------------------------\\n5 · What They’ll Pay\\n---------------------------------------------------------\\n18. Willingness-to-pay — $800-$1,400 for a comprehensive, mentored program (survey above: median $997).  \\n19. Benchmarking — 63 comparable online programs avg. $1,085 (stdev $412). Your $997 price sits at the 46th percentile → perceived fair-value, room for premium upsells (VIP cohort, 1-on-1).\\n\\n---------------------------------------------------------\\n6 · Should We Build It?\\n---------------------------------------------------------\\n20. Go / No-go — GO.  \\n21. Core justification — Niche growth + clear competitor weaknesses (live coaching, corporate luxury, vendor simulations) allow a differentiated $1 k product with realistic 20-30 % EBITDA margins.\\n\\n---------------------------------------------------------\\n7 · 1-Year Revenue Outlook\\n---------------------------------------------------------\\nAssumptions: $997 base price; 2 launches (Spring, Fall); 20 % promo affiliate share; ad CPA $210; email list 10 k; IG/TikTok reach 45 k; 3 % funnel conversion.\\n\\n22. Bad scenario — 75 students/year → Gross $74,775 → Net ≈ $41 k.  \\n23. Good scenario — 225 students/year → Gross $224,325 → Net ≈ $123 k.  \\n24. Excellent scenario — 500 students/year → Gross $498,500 → Net ≈ $274 k.  \\n25. Industry average — Similar 8-module certification courses earn ≈ $145 k in year 1 (Thinkific dataset, 2023).  \\n26. Likely outcome — $190 k gross (≈184 students) → 31 % above industry average.  \\n27. Scenario drivers  \\n    • Audience size / warm list growth (25 % swing)  \\n    • Paid-ad budget & creative (CPA can range $180-$320)  \\n    • Influencer partnerships with top planners (5 + affiliates = +40 students)  \\n    • Tiered pricing (VIP Mentorship add-on at $1,997 upsells 8-12 % of buyers).\\n\\n---------------------------------------------------------\\nBottom Line\\nA focused, 6-week luxury event-planning program that blends live negotiation drills, corporate + social event case studies, and premium pricing strategy fills a demonstrable gap. With disciplined marketing, a first-year gross of ~$190 k is the most probable outcome—enough to justify development.']\n- Output: courseData = {\n/* Customize these values for each new lead magnet */\nbrandColors: {\nprimary: \"#1f2937\", // dark slate for luxury feel\nlight: \"#f3f4f6\",   // light gray background\n},\nmeta: {\ncourseTitle: \"Six-Figure Luxury Event Planning Masterclass\",\nreportTitle: \"Luxury Event Planning Market Snapshot\",\n},\ndemand: {\nscore: 7.2,\npercentile: 82,\nquestion: \"Should you create a luxury event planning certification?\",\nanswer:\n\"Yes. This niche ranks in the top 18% of education markets tracked, with strong momentum post-COVID.\",\nwhy:\n\"Google searches for “luxury event planning” are up 64% vs. 2019, and social buzz (TikTok hashtag views, LinkedIn group growth) confirms rising interest.\",\n},\ntesting: {\noverview:\n\"Turn intermediate planners into sought-after specialists who land, price, and execute six-figure luxury events.\",\ntargetAudience:\n\"Working event planners or venue/hotel coordinators with 1–5 years’ experience earning under $85K seeking to move up-market.\",\nformat:\n\"6-week program: 8 modules, 40 short HD videos, 8 live “board-room” clinics, 15 downloadable checklists & Canva templates, private Slack community, 2 live vendor negotiation simulations.\",\nquestion: \"Why this course?\",\nanswer:\n\"It unifies venue-centric workflows, luxury aesthetics, premium pricing strategy, and UHNW client psychology in a compact, practice-focused format.\",\nwhy:\n\"Existing offerings are either too broad (general MOOCs), too wedding-focused, or lack live simulations and corporate luxury content.\",\ncontentPillars: [\n\"Luxury market positioning & personal branding\",\n\"Venue-first design methodology\",\n\"Vendor negotiation & partnership frameworks\",\n\"Premium pricing, contracts, legal & risk management\"\n],\n},\ntrends: {\ngoogleSearchChangePct: 64,\nsocialMediaGrowthPct: 27,\nmacroFactor:\n\"Post-pandemic “revenge spending,” rising corporate experiential budgets, easy travel fueling destination events, and Instagram-driven social-proof demand.\",\nquestion: \"Is this topic trending?\",\nanswer:\n\"Yes. Search volume and social engagement are surging, underpinned by strong HNWI and corporate spend growth.\",\nwhy:\n\"Google Trends shows +64% over five years; top luxury-event Instagram accounts grew 27% in 2023; LinkedIn group members nearly tripled.\",\n},\ncompetitors: {\nquestion: \"Who else teaches luxury event planning?\",\nanswer:\n\"A handful of specialist programs, none combine a short timeline, live vendor labs, corporate case studies, and UHNW pricing strategy.\",\nwhy:\n\"Most focus on weddings or offer lengthy, dated content without real-world simulations.\",\nlist: [\n{\nname: \"QC Event School – Luxury Wedding & Event Planning Certification\",\nstrengths: \"Affordable payment plans; tutor feedback\",\nweaknesses: \"6-month timeline; no live vendor labs; dated branding modules\",\npriceUSD: 744,\n},\n{\nname: \"The Event Academy (UK) – Luxury & Special Events Diploma\",\nstrengths: \"University-backed; in-person site visits in London\",\nweaknesses: \"£1,850 price; geographic friction; corporate events under-represented\",\npriceUSD: 2320,\n},\n{\nname: \"Lovegevity / LWPI – Certified Luxury Wedding & Event Planner\",\nstrengths: \"Includes internship; global alumni network\",\nweaknesses: \"Heavy wedding bias; generic templates; limited corporate/UHNW focus\",\npriceUSD: 1295,\n},\n],\n},\nworries: {\nquestion: \"What do potential learners worry about?\",\nanswer:\n\"They fear not attracting affluent clients, mispricing, vendor contracts mistakes, and operational overwhelm.\",\nwhy:\n\"Surveys of 214 planners and social-media forums show pricing, portfolio, contract risks, and logistics as top pain points.\",\ntopConcerns: [\n\"“How do I land affluent clients with a small portfolio?”\",\n\"“How do I price high-end services without scaring leads off?”\",\n\"“Vendor mark-ups and contracts terrify me—one error wipes out profit.”\",\n\"“I’m creatively strong but overwhelmed by timelines and logistics.”\"\n],\n},\npricing: {\nquestion: \"How much will learners pay?\",\nanswer:\n\"Between $800 and $1,400 for a comprehensive, mentored luxury program (median $997).\",\nwhy:\n\"Survey median willingness-to-pay is $997; comparable programs average $1,085.\",\ntargetPriceUSD: 997,\n},\nbuildDecision: {\nquestion: \"Based on the data, should you build this course?\",\nanswer: \"GO.\",\nwhy:\n\"Strong niche growth, clear competitor gaps (short timeline, live simulations, corporate luxury focus) and healthy margins at a $1K price point.\",\n},\nrevenueOutlook: {\nlaunchTimelineDays: 60,\nlikelyRevenueUSD: 190000,\nindustryAverageUSD: 145000,\nscenarios: [\n{ name: \"Lower\", students: 75, priceUSD: 997, revenueUSD: 74775 },\n{ name: \"Mid\",    students: 184, priceUSD: 997, revenueUSD: 183448 },\n{ name: \"High\",   students: 500, priceUSD: 997, revenueUSD: 498500 }\n],\nquestion: \"What’s the 1-year revenue potential?\",\nanswer:\n\"Realistically, gross ~$190K (≈184 students). Upside to $498K in a best-case scenario.\",\nwhy:\n\"Based on 2 launches, 3% funnel conversion from 10K email list + paid ads, 20–30% EBITDA margins.\",\n},\nopportunityScore: 78,\n};]\n\nPlease follow the provided courseData structure and adapt it using insights from the specific market research report. Adjust content for relevance, clarity, and engagement based on the findings. Start with courseData = { and end with }""" 
# market_report_prompt = """Given a market research report, restructure its insights into window.courseData as a single-line JavaScript assignment following the full structure and data types of the example below. Your output must start with window.courseData= and end with ;, with all data in the shown key order (including the nested lightMode and darkMode brandColors). Only output valid JavaScript—no line breaks, no comments, no extra text.Example output:
# window.courseData={brandColors:{lightMode:{background:"#F6F9FC",primary:"#0A2540",text:"#1F2937",textSecondary:"#4B5563",accent:"#3B82F6",border:"#E5E7EB"},darkMode:{background:"#0A2540",primary:"#F6F9FC",text:"#D1D5DB",textSecondary:"#9CA3AF",accent:"#60A5FA",border:"#374151"}},meta:{courseTitle:"Stripe Revenue Recovery Bootcamp",reportTitle:"Stripe Failed-Payment Market Snapshot 2025"},demand:{score:7.8,percentile:84,question:"Should you create a Stripe revenue-recovery course?",answer:"Yes—demand is high and pressing.",why:"• Subscription spend is > 50 % of U.S. software outlays, yet involuntary churn still erodes 9–15 % of MRR for SMB SaaS.\n• Google searches for “Stripe failed payment” and related keywords are up 38 % vs 2020.\n• Few hands-on programs serve RevOps leads; every extra 1 % recovered revenue lifts valuation 3–4 %."},testing:{overview:"Cut involuntary churn by 30–50 % in 60 days using Stripe’s recovery stack and proven playbooks.",targetAudience:"Seed-to-Series-B SaaS founders, RevOps managers, and senior developers already using Stripe.",format:"4-week cohort: 8 modules, ≈5 h HD video, copy + code swipe files, ROI calculator, 2 live clinics, private Slack.",question:"Why this course over free docs or webinars?",answer:"It unites technical execution (webhooks, Smart Retries) with revenue-ops strategy (KPIs, messaging) in one ROI-backed package.",why:"Current resources are siloed—Stripe docs are developer-centric; ProfitWell webinars are product-led. No single source bridges both worlds for small teams.",contentPillars:["Root-cause analytics of payment failures","Smart Retries, Adaptive Acceptance & webhook logic","High-converting 7-touch dunning cadences (email/SMS/localization)","Compliance, disputes & tracking ‘Recovered MRR’"]},trends:{googleSearchChangePct:51,socialMediaGrowthPct:26,macroFactor:"Net-revenue-retention scrutiny, Visa CE 3.0 dispute rules, and expensive capital make revenue recovery the cheapest growth lever.",question:"Is interest still climbing?",answer:"Yes—searches, subreddit growth and newsletter sign-ups are all accelerating.",why:"• ‘Stripe failed payment’ +74 % in 5 yrs\n• r/Stripe tripled members in < 3 yrs\n• Patrick McKenzie’s payment-failure newsletter tripled subscribers (14 k→43 k)"},competitors:{question:"Who else teaches Stripe payment recovery?",answer:"Only three notable options, none offer a vendor-specific yet product-agnostic, ROI-guaranteed cohort.",why:"Udemy is beginner-centric, LevelUp is dev-only, ProfitWell Retain is a lead-gen funnel locked to their tool.",list:[{name:"Udemy — Stripe Payments Masterclass 2024",strengths:"Low price, solid step-by-step setup",weaknesses:"Lacks advanced retries, dunning, or KPI focus",priceUSD:19.99},{name:"LevelUp Tutorials — Modern Payments with Stripe",strengths:"In-depth code demos",weaknesses:"Developer-centric; minimal RevOps or compliance content",priceUSD:249},{name:"ProfitWell Retain Workshops",strengths:"Great benchmarks, strategic framing",weaknesses:"Free but tied to ProfitWell product; Stripe feature depth shallow",priceUSD:0}]},worries:{question:"What keeps learners up at night?",answer:"Revenue leakage, technical uncertainty, and compliance risk.",why:"Surveys and conference panels show ≥ 70 % citing failed payments as a top churn driver and Stripe docs as too technical.",topConcerns:["“We lose 10 % of customers monthly and don’t know why.”","“Stripe docs are too technical; ops can’t translate them.”","“Chargebacks are spiking—are we at risk of account termination?”","“Generic dunning emails aren’t moving the needle.”"]},pricing:{question:"What will the market pay?",answer:"$499 list (≈$399 after promos) positions us at the 65th percentile of comparable B2B tech courses.",why:"SMB SaaS execs will pay $300–800 if ROI ≥ 10×. Median benchmark is $397; $499 signals premium yet attainable.",targetPriceUSD:499},buildDecision:{question:"Based on the data, should we build it?",answer:"GO.",why:"High pain, scarce competition, and clear financial upside for learners give first-mover advantage."},revenueOutlook:{launchTimelineDays:45,likelyRevenueUSD:59800,industryAverageUSD:75000,scenarios:[{name:"Lower",students:50,priceUSD:399,revenueUSD:19900},{name:"Mid",students:150,priceUSD:399,revenueUSD:59850},{name:"High",students:500,priceUSD:399,revenueUSD:199500}],question:"What’s the 12-month upside?",answer:"Realistically ≈ $60 k gross on a 150-student year-one cohort; upside to $200 k with breakout reach.",why:"Assumes 20 % promo rate, list + partner reach of 8–10 k founders, and 1.5–2 % funnel conversion."},opportunityScore:83};"""
market_search_report = """Is It Worth It?  (Demand Score)\n1. Market momentum — Very healthy.  Since 2020, record numbers of door-to-door “summer sales” reps (pest control, alarms, solar) have migrated to life-insurance, driven by higher residual commissions and the ability to sell via Zoom.  IMOs such as Family First Life, Symmetry Financial and Integrity Marketing Group each added 10-30 K new agents in the past 24 months.  \n2. Demand score — 7.9 / 10  (≈ top 20 % of all online-education niches).  \n3. Rationale —  \n   • Google searches for “start insurance agency” (+32 % 5-yr) and “life insurance agent training” (+18 %) are climbing.  \n   • LinkedIn shows > 19 000 posted jobs for “life-insurance agent” in the U.S. (June 2025), +41 % vs. 2022.  \n   • Existing paid courses/coaching groups are small but profitable; most are at capacity or run wait-lists.  \n   • Rising dissatisfaction among reps who feel stuck in 100 %-commission door-knocking roles and want residual income.\n\n1 · What We’re Testing\n4. Course focus — Turn a seasonal door-to-door salesperson into a licensed, fully contracted life-insurance agency owner within 4–6 months.  \n5. Ideal learner — 22-35-year-old commission-only sales rep (summer sales alumni, solar/alarm/pest) earning $35-80 K who wants location-flexible, year-round residual income.  \n6. Delivery format — 6 modules, 4–6 hrs each.  Mix: pre-recorded video (70 %), live weekly Q&A / role-play calls (20 %), templates & checklists (10 %).  Optional coaching upsell.  \n7. Gap analysis — Today, knowledge is scattered across:  \n   • State licensing exam prep sites (Kaplan, ExamFX)  \n   • IMO recruiting webinars (biased)  \n   • YouTube how-tos (piecemeal)  \n   • Agency-management books (dated)  \n   Consolidating licensing, carrier contracting, lead-gen, team building and compliance in one step-by-step path removes weeks of trial-and-error and costly mis-contracts.  \n8. Key content pillars —  \n   1) Licensing & regulatory compliance by state  \n   2) Product mastery (term, IUL, final-expense, annuities)  \n   3) Agency setup, carrier appointments & E&O / AML requirements  \n   4) Lead-generation systems, virtual selling scripts & recruiting first agents  \n\n2 · Big Trends\n9. Search trajectory — Google Trends (May 2020–May 2025):  \n   • “Start insurance agency”  +32 %  \n   • “Life insurance agent”     +15 %  \n10. Social-media signals —  \n   • “Life Insurance Academy” YouTube: 7 K → 31 K subs (+340 % in 24 mo)  \n   • TikTok hashtag #insuranceagent: 128 M views, +55 % YoY  \n   • Facebook group “Insurance Sales 101” grew 22 K → 41 K members in 18 mo.  \n11. Macro forces —  \n   • Remote-first selling normalized post-COVID.  \n   • Millennials hit prime insurance-buying age; LIMRA reports 39 % intend to purchase life cover in 2025.  \n   • States pushing electronic licensing & faster background checks, lowering entry friction.  \n\n3 · Who’s Out There  (Competitor Landscape)\n12. Top competitors —  \n   1) Cody Askins “8% Virtual Training University”  \n   2) David Duford’s “Agency Building Mastery”  \n   3) Craig Wiggins Coaching & Consulting (CWCC)  \n13. Strengths vs. weaknesses —  \n   • Askins: Huge energy + events; weak on agency-formation nuts-and-bolts.  \n   • Duford: Deep product & recruiting playbooks; little on tech automations.  \n   • CWCC: Strong accountability coaching; built around Allstate/P&C, not life-focused.  \n14. Pricing — Askins $97/mo or $997 yr; Duford $1 497 one-time; CWCC $297/mo.  \n15. Opportunity gap — Speak directly to door-to-door “summer sales” migrants; integrate licensing → contracting → first hires in one linear blueprint plus modern CRM/automation stack (GoHighLevel, InsuranceToolKit).  None of the above do this end-to-end.  \n\n4 · Learner Worries / Pain Points\n16. Primary anxieties —  \n   1) “How do I pass the state exam fast?”  \n   2) “Which carriers/IMOs won’t trap me in bad contracts?”  \n   3) “Where will my first affordable leads come from?”  \n   4) “What does it really cost to open an agency?”  \n17. Evidence —  \n   • r/Insurance, r/Sales threads (Feb–Apr 2025): 73 % of 212 comments cite licensing or carrier-contract confusion.  \n   • LIMRA 2024 agent-attrition survey: 68 % quit in year 1 due to lead scarcity & cash-flow.  \n   • Facebook poll in “Door-to-Door Millionaires” group (1 100 votes): 71 % listed “uncertain startup costs/contracts” as #1 barrier.  \n\n5 · What They’ll Pay\n18. Willingness-to-pay — $497–$1 497 for a comprehensive, step-by-step program including live calls.  \n19. Benchmarking — Of 63 comparable digital or cohort programs in vocational sales/insurance:  \n   • Median price: $897  \n   • 80th-percentile price: $1 497  \n   Our range aligns with market expectations.  \n\n6 · Should We Build It?\n20. Go / No-go — GO.  \n21. Core justification — Clear spike of commission-only sales reps seeking residual-income careers, combined with a fragmented learning landscape and few programs tailored to their exact starting point.  \n\n7 · 1-Year Revenue Outlook  (assume core course at $997)  \n22. Bad scenario — 80 students → $79 760  \n23. Good scenario — 300 students → $299 100  \n24. Excellent scenario — 700 students → $697 900  \n25. Industry average (vocational sales courses, 12 mo) — $184 000 revenue  \n26. Likely outcome — ~$250 000 in year 1 (≈ +36 % vs. industry average), based on moderate list size (10 K), 1 % conversion, $2 500 ad spend/mo.  \n27. Scenario drivers —  \n   • Audience size & channel (YouTube, TikTok, LinkedIn)  \n   • Paid-ads ROAS on Facebook/YouTube targeting solar/pest/alarm reps  \n   • Referral / affiliate deals with IMOs  \n   • Price positioning ($997 core, $2 997 coaching upsell)  \n\nBottom line:  Demand, pricing power and an obvious content gap make this course a solid bet, provided you can quickly build authority inside door-to-door sales communities.', type='output_text')], role='assistant', status='completed', type='message')], parallel_tool_calls=True, temperature=1.0, tool_choice='auto', tools=[], top_p=1.0, max_output_tokens=None, previous_response_id=None, reasoning=Reasoning(effort='high', generate_summary=None, summary=None), service_tier='default', status='completed', text=ResponseTextConfig(format=ResponseFormatText(type='text')), truncation='disabled', usage=ResponseUsage(input_tokens=812, input_tokens_details=InputTokensDetails(cached_tokens=0), output_tokens=2493, output_tokens_details=OutputTokensDetails(reasoning_tokens=896), total_tokens=3305), user=None, store=True) response"""
market_report_prompt = """Given a market research report, restructure its insights into window.courseData as a single-line JavaScript assignment following the full structure and data types of the example below. Your output must start with window.courseData= and end with ;, with all data in the shown key order. Use *only* light-mode brandColors (background, primary, text, textSecondary, accent, border) and **do not** include a darkMode object. For each of the top three competitors, include both a websiteUrl and a logoUrl field. Only output valid JavaScript—no line breaks, no comments, no extra text. Example output: window.courseData={brandColors:{background:"#F6F9FC",primary:"#0A2540",text:"#1F2937",textSecondary:"#4B5563",accent:"#3B82F6",border:"#E5E7EB"},meta:{courseTitle:"Stripe Revenue Recovery Bootcamp",reportTitle:"Stripe Failed-Payment Market Snapshot 2025"},demand:{score:7.8,percentile:84,question:"Should you create a Stripe revenue-recovery course?",answer:"Yes—demand is high and pressing.",why:"• Subscription spend is > 50 % of U.S. software outlays, yet involuntary churn still erodes 9–15 % of MRR for SMB SaaS. • Google searches for “Stripe failed payment” and related keywords are up 38 % vs 2020. • Few hands-on programs serve RevOps leads; every extra 1 % recovered revenue lifts valuation 3–4 %."},testing:{overview:"Cut involuntary churn by 30–50 % in 60 days using Stripe’s recovery stack and proven playbooks.",targetAudience:"Seed-to-Series-B SaaS founders, RevOps managers, and senior developers already using Stripe.",format:"4-week cohort: 8 modules, ≈5 h HD video, copy + code swipe files, ROI calculator, 2 live clinics, private Slack.",question:"Why this course over free docs or webinars?",answer:"It unites technical execution (webhooks, Smart Retries) with revenue-ops strategy (KPIs, messaging) in one ROI-backed package.",why:"Current resources are siloed—Stripe docs are developer-centric; ProfitWell webinars are product-led. No single source bridges both worlds for small teams.",contentPillars:["Root-cause analytics of payment failures","Smart Retries, Adaptive Acceptance & webhook logic","High-converting 7-touch dunning cadences (email/SMS/localization)","Compliance, disputes & tracking ‘Recovered MRR’"]},trends:{googleSearchChangePct:51,socialMediaGrowthPct:26,macroFactor:"Net-revenue-retention scrutiny, Visa CE 3.0 dispute rules, and expensive capital make revenue recovery the cheapest growth lever.",question:"Is interest still climbing?",answer:"Yes—searches, subreddit growth and newsletter sign-ups are all accelerating.",why:"• ‘Stripe failed payment’ +74 % in 5 yrs • r/Stripe tripled members in < 3 yrs • Patrick McKenzie’s payment-failure newsletter tripled subscribers (14 k→43 k)"},competitors:{question:"Who else teaches Stripe payment recovery?",answer:"Only three notable options, none offer a vendor-specific yet product-agnostic, ROI-guaranteed cohort.",why:"Udemy is beginner-centric, LevelUp is dev-only, ProfitWell Retain is a lead-gen funnel locked to their tool.",list:[{name:"Udemy — Stripe Payments Masterclass 2024",strengths:"Low price, solid step-by-step setup",weaknesses:"Lacks advanced retries, dunning, or KPI focus",priceUSD:19.99,websiteUrl:"https://www.udemy.com/course/stripe-payments-masterclass/",logoUrl:"https://s.udemycdn.com/meta/default-meta-image-v2.png"},{name:"LevelUp Tutorials — Modern Payments with Stripe",strengths:"In-depth code demos",weaknesses:"Developer-centric; minimal RevOps or compliance content",priceUSD:249,websiteUrl:"https://leveluptutorials.com/tutorials/modern-payments-with-stripe",logoUrl:"https://leveluptutorials.com/favicon.ico"},{name:"ProfitWell Retain Workshops",strengths:"Great benchmarks, strategic framing",weaknesses:"Free but tied to ProfitWell product; Stripe feature depth shallow",priceUSD:0,websiteUrl:"https://www.profitwell.com/retain",logoUrl:"https://www.profitwell.com/favicon.ico"}]},worries:{question:"What keeps learners up at night?",answer:"Revenue leakage, technical uncertainty, and compliance risk.",why:"Surveys and conference panels show ≥ 70 % citing failed payments as a top churn driver and Stripe docs as too technical.",topConcerns:["“We lose 10 % of customers monthly and don’t know why.”","“Stripe docs are too technical; ops can’t translate them.”","“Chargebacks are spiking—are we at risk of account termination?”","“Generic dunning emails aren’t moving the needle.”"]},pricing:{question:"What will the market pay?",answer:"$499 list (≈$399 after promos) positions us at the 65th percentile of comparable B2B tech courses.",why:"SMB SaaS execs will pay $300–800 if ROI ≥ 10×. Median benchmark is $397; $499 signals premium yet attainable.",targetPriceUSD:499},buildDecision:{question:"Based on the data, should we build it?",answer:"GO.",why:"High pain, scarce competition, and clear financial upside for learners give first-mover advantage."},revenueOutlook:{launchTimelineDays:45,likelyRevenueUSD:59800,industryAverageUSD:75000,scenarios:[{name:"Lower",students:50,priceUSD:399,revenueUSD:19900},{name:"Mid",students:150,priceUSD:399,revenueUSD:59850},{name:"High",students:500,priceUSD:399,revenueUSD:199500}],question:"What’s the 12-month upside?",answer:"Realistically ≈ $60 k gross on a 150-student year-one cohort; upside to $200 k with breakout reach.",why:"Assumes 20 % promo rate, list + partner reach of 8–10 k founders, and 1.5–2 % funnel conversion."},opportunityScore:83};"""


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title id="pageTitle"></title>

  <!-- Tailwind 3 – CDN build (JIT) -->
  <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
  <script>
    /* Minimal Tailwind config (no dark mode) */
    tailwind.config = {
      theme: {
        extend: {
          boxShadow: {
            brand: '0 8px 28px rgba(0,0,0,.06), 0 2px 8px rgba(0,0,0,.04)',
          },
        }
      }
    }
  </script>

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.gstatic.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..800&display=swap" rel="stylesheet" />

  <!-- Chart.js + plugins -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@1.4.0/dist/chartjs-plugin-annotation.min.js" defer></script>

  <!-- Hero-icon-js -->
  <script src="https://cdn.jsdelivr.net/npm/hero-icon-js/hero-icon-outline.min.js" defer></script>
  <script src="https://cdn.jsdelivr.net/npm/hero-icon-js/hero-icon-solid.min.js" defer></script>

  <style>
    /* ========== 1. CSS Variables (light only) ========== */
    :root {
      --light-bg:         #ffffff;
      --light-primary:    #0a2540;
      --light-text:       #1f2937;
      --light-text2:      #4b5563;
      --light-accent:     #3b82f6;
      --light-border:     #e5e7eb;

      --background:       var(--light-bg);
      --primary:          var(--light-primary);
      --text-strong:      var(--light-text);
      --text-soft:        var(--light-text2);
      --accent:           var(--light-accent);
      --border:           var(--light-border);
    }

    /* ========== 2. Base styles & utilities ========== */
    html {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--background);
      color: var(--text-strong);
    }
    body {
      min-height: 100vh;
    }
    ::selection {
      background: var(--accent);
      color: #fff;
    }

    /* Scrollbars */
    ::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    ::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 8px;
    }

    /* Reveal-on-scroll */
    .reveal {
      opacity: 0;
      transform: translateY(28px);
      transition: opacity .6s, transform .6s;
    }
    .reveal.visible {
      opacity: 1;
      transform: none;
    }

    /* Sticky table header on ≥lg */
    @media (min-width:1024px) {
      thead.table-header-sticky {
        position: sticky; 
        top: 0; 
        backdrop-filter: blur(8px);
      }
    }
  </style>
</head>

<body class="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] antialiased">

  <!-- Skip link for accessibility -->
  <a href="#content" class="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 bg-[var(--primary)] text-white rounded px-3 py-1 z-50">
    Skip to content
  </a>

  <!-- ───────────────────────  SIDEBAR  ─────────────────────── -->
  <aside id="toc"
    class="hidden lg:block sticky top-0 h-screen overflow-y-auto border-r 
           border-[var(--border)] bg-[var(--background)] p-6 z-30"
    aria-label="Table of contents">
    <header class="flex justify-between items-center mb-6">
      <h2 class="uppercase tracking-wide font-semibold text-xs text-[var(--text-soft)]">On this page</h2>
      <!-- (Removed theme toggle button) -->
    </header>
    <nav id="tocLinks" class="space-y-2 leading-6 text-sm"></nav>
  </aside>

  <!-- ───────────────────────  MAIN  ─────────────────────── -->
  <main id="content" class="px-4 sm:px-6 py-14">
    <!-- HERO / HEADER -->
    <header
      class="relative rounded-xl mb-8 reveal visible overflow-hidden
             bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/70 text-white 
             shadow-brand">
      <div class="px-6 py-14 sm:py-20 text-center">
        <h1 id="courseTitle" class="text-4xl sm:text-5xl font-extrabold"></h1>
        <p id="reportSubtitle" class="mt-4 text-lg/relaxed text-white/90"></p>
      </div>
      <span id="opportunityScore"
        class="absolute top-4 right-4 sm:right-8 bg-black/10 
               backdrop-blur px-4 py-1 rounded-full text-sm font-semibold">
      </span>
    </header>

    <!-- KPI SUMMARY -->
    <section id="kpiSummary"
      class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-sm mb-10
             bg-[var(--background)] shadow-brand ring-1 ring-black/5 
             rounded-xl p-5 reveal">
    </section>

    <!-- Nav (hamburger) for mobile -->
    <button id="tocToggle"
      class="lg:hidden fixed bottom-6 right-6 z-[60] bg-[var(--primary)] text-white p-3 
             rounded-full shadow-brand focus:ring-4 ring-[var(--primary)]/50"
      aria-controls="toc" aria-expanded="false">
      <hero-icon-outline name="bars-3" class="w-6 h-6"></hero-icon-outline>
    </button>

    <!-- Template for dynamic sections -->
    <template id="sectionTemplate">
      <section
        class="reveal mb-14 rounded-xl ring-1 ring-black/5 shadow-brand 
               bg-[var(--background)] lg:grid lg:grid-cols-[minmax(0,680px)_1fr] 
               lg:gap-12 p-8 space-y-6">
        <div>
          <div class="flex items-center gap-3 mb-4">
            <span class="icon-wrap shrink-0"></span>
            <h2 class="title text-2xl font-bold tracking-tight text-[var(--primary)]"></h2>
          </div>
          <div class="section-body prose max-w-none"></div>
        </div>
        <div class="section-chart-col flex items-center justify-center mt-4 lg:mt-0"></div>
      </section>
    </template>

    <!-- Final verdict placeholder (will be populated via JS) -->
    <section id="verdict" class="hidden"></section>
  </main>

  <!-- Desktop CTA (Back-to-top) -->
  <div id="ctaBar"
    class="hidden lg:flex fixed bottom-6 right-6 items-center gap-4
           bg-[var(--primary)] text-white px-6 py-3 rounded-full shadow-brand z-[55]">
    <button class="font-semibold hover:bg-white/10 px-3 py-1 rounded focus:ring-2 ring-inset ring-white/60"
            onclick="window.scrollTo({top:0,behavior:'smooth'})">↑ Top</button>
  </div>

  <!-- ───────────────────────  AUDIO BAR w/ React  ─────────────────────── -->
  <div id="react-root"></div>

  <!-- ───────────────────────  SCRIPTS  ─────────────────────── -->
  <script>
/* -----------------------------------------------------------
   Helper: loadScript(url)  (returns Promise)
------------------------------------------------------------*/
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ' + url));
    document.head.appendChild(s);
  });
}

/* -----------------------------------------------------------
   Heroicon helper
------------------------------------------------------------*/
function icon(name, cls='w-6 h-6 text-[var(--primary)]'){
  return `<hero-icon-outline name="${name}" class="${cls}"></hero-icon-outline>`;
}

/* -----------------------------------------------------------
   Load external COURSE DATA script, then build UI
   Replace CUSTOM_VALUES_MARKET_RESEARCH_REPORT with your script URL
------------------------------------------------------------*/
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadScript(CUSTOM_VALUES_MARKET_RESEARCH_REPORT); // Must define window.courseData
    buildPage();
  } catch (e) {
    console.error(e);
  }
});

/* -----------------------------------------------------------
   Apply brandColors (light only)
------------------------------------------------------------*/
function applyBrandColors(bc) {
  // We only read bc.lightMode here (always light)
  if (!bc.lightMode) return;
  document.documentElement.style.setProperty('--light-bg',         bc.lightMode.background     || '#ffffff');
  document.documentElement.style.setProperty('--light-primary',    bc.lightMode.primary       || '#0a2540');
  document.documentElement.style.setProperty('--light-text',       bc.lightMode.text          || '#1f2937');
  document.documentElement.style.setProperty('--light-text2',      bc.lightMode.textSecondary || '#4b5563');
  document.documentElement.style.setProperty('--light-accent',     bc.lightMode.accent        || '#3b82f6');
  document.documentElement.style.setProperty('--light-border',     bc.lightMode.border        || '#e5e7eb');
}

function buildPage() {
  if (!window.courseData) {
    return console.error('courseData missing');
  }
  const d = window.courseData;

  // 1. Apply brandColors (light only)
  if(d.brandColors) {
    applyBrandColors(d.brandColors);
  }

  // 2. Title & header info
  const pageTitle = `${d.meta.courseTitle} · ${d.meta.reportTitle}`;
  document.title = pageTitle;
  document.getElementById('pageTitle').textContent = pageTitle;
  document.getElementById('courseTitle').textContent = d.meta.courseTitle;
  document.getElementById('reportSubtitle').textContent = d.meta.reportTitle;
  document.getElementById('opportunityScore').textContent = `Score ${d.opportunityScore}/100`;

  // 3. TOC setup
  const tocData = [
    ['worthIt','Should You Make It?','light-bulb'],
    ['overview','Course Overview','book-open'],
    ['trends','Market Trends','chart-bar'],
    ['competitors','Competition','users'],
    ['worries','Learner Concerns','exclamation-triangle'],
    ['pricing','Ideal Pricing','currency-dollar'],
    ['outlook','Revenue Outlook','chart-pie'],
    ['verdict','Conclusion','check-circle']
  ];
  const tocLinks = document.getElementById('tocLinks');
  tocData.forEach(([id,label,heroIcon]) => {
    const a = document.createElement('a');
    a.href = '#'+id;
    a.className = 'block px-3 py-1 rounded hover:text-[var(--primary)] transition-colors';
    a.innerHTML = label;
    tocLinks.appendChild(a);
  });

  // hamburger toggle
  const tocDrawer = document.getElementById('toc');
  const tocToggle = document.getElementById('tocToggle');
  tocToggle.onclick = () => {
    tocDrawer.classList.toggle('hidden');
    const expanded = !tocDrawer.classList.contains('hidden');
    tocToggle.setAttribute('aria-expanded', expanded);
  };

  // 4. Build dynamic sections
  const main = document.querySelector('main');
  const template = document.getElementById('sectionTemplate');

  const sectionsData = [
    {
      id:'worthIt', icon:'light-bulb', title:'1 · Should You Make It?',
      html: `
        <div class="flex flex-wrap gap-2 text-sm mb-6">
          <span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
            Demand Score <strong>${d.demand.score}/10</strong>
          </span>
          <span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800">
            Top <strong>${d.demand.percentile}%</strong>
          </span>
        </div>
        <p class="italic mb-2"><strong>Question:</strong> “${d.demand.question}”</p>
        <p><strong>Answer:</strong> ${d.demand.answer}</p>
        <p><strong>Why:</strong> ${d.demand.why}</p>
      `,
      chart:'scoreChart',
    },
    {
      id:'overview', icon:'book-open', title:'2 · Course Overview',
      html: `
        <div class="flex flex-wrap gap-2 text-sm mb-4">
          <span class="chip">Overview:&nbsp;<strong>${d.testing.overview}</strong></span>
          <span class="chip">Audience:&nbsp;<strong>${d.testing.targetAudience}</strong></span>
          <span class="chip">Format:&nbsp;<strong>${d.testing.format}</strong></span>
        </div>
        <p class="italic mb-2"><strong>Question:</strong> “${d.testing.question}”</p>
        <p><strong>Answer:</strong> ${d.testing.answer}</p>
        <p><strong>Why:</strong> ${d.testing.why}</p>
        <ul class="list-disc list-inside grid sm:grid-cols-2 gap-x-6 mt-4 text-sm">
          ${ d.testing.contentPillars.map(p=>`<li>${p}</li>`).join('') }
        </ul>
      `,
    },
    {
      id:'trends', icon:'chart-bar', title:'3 · Market Trends',
      html: `
        <div class="flex flex-wrap gap-2 text-sm mb-4">
          <span class="chip bg-emerald-100 text-emerald-800">
            Google +${d.trends.googleSearchChangePct}%
          </span>
          <span class="chip bg-cyan-100 text-cyan-800">
            Social +${d.trends.socialMediaGrowthPct}%
          </span>
          <span class="chip">${d.trends.macroFactor}</span>
        </div>
        <p class="italic mb-2"><strong>Question:</strong> “${d.trends.question}”</p>
        <p><strong>Answer:</strong> ${d.trends.answer}</p>
        <p><strong>Why:</strong> ${d.trends.why}</p>
      `,
      chart:'trendChart',
    },
    {
      id:'competitors', icon:'users', title:'4 · Competition',
      html: `
        <p class="italic mb-2"><strong>Question:</strong> “${d.competitors.question}”</p>
        <p><strong>Answer:</strong> ${d.competitors.answer}</p>
        <p><strong>Why:</strong> ${d.competitors.why}</p>
        <div class="overflow-x-auto mt-4">
          <table class="min-w-full text-sm whitespace-nowrap">
            <thead class="table-header-sticky bg-[var(--background)] text-[var(--text-strong)]">
              <tr>
                <th class="py-2 px-4 font-semibold">Resource</th>
                <th class="py-2 px-4 font-semibold">Strengths</th>
                <th class="py-2 px-4 font-semibold">Weaknesses</th>
                <th class="py-2 px-4 font-semibold text-right">Price</th>
              </tr>
            </thead>
            <tbody id="competitorTable" class="divide-y divide-[var(--border)]"></tbody>
          </table>
        </div>
      `,
    },
    {
      id:'worries', icon:'exclamation-triangle', title:'5 · Learner Concerns',
      html: `
        <p class="italic mb-2"><strong>Question:</strong> “${d.worries.question}”</p>
        <p><strong>Answer:</strong> ${d.worries.answer}</p>
        <p><strong>Why:</strong> ${d.worries.why}</p>
        <ul class="list-disc list-inside grid sm:grid-cols-2 gap-x-6 mt-4 text-sm">
          ${ d.worries.topConcerns.map(c=>`<li>${c}</li>`).join('') }
        </ul>
      `,
    },
    {
      id:'pricing', icon:'currency-dollar', title:'6 · Ideal Pricing',
      html: `
        <p class="italic mb-2"><strong>Question:</strong> “${d.pricing.question}”</p>
        <p><strong>Answer:</strong> ${d.pricing.answer}</p>
        <p><strong>Why:</strong> ${d.pricing.why}</p>
      `,
      chart:'priceChart',
    },
    {
      id:'outlook', icon:'chart-pie', title:'7 · Revenue Outlook',
      html: `
        <div class="flex flex-wrap gap-2 text-sm mb-4">
          <span class="chip bg-emerald-100 text-emerald-800">
            Likely $${d.revenueOutlook.likelyRevenueUSD}
          </span>
          <span class="chip bg-blue-100 text-blue-800">
            vs $${d.revenueOutlook.industryAverageUSD} avg
          </span>
          <span class="chip bg-purple-100 text-purple-800">
            Launch in ${d.revenueOutlook.launchTimelineDays} days
          </span>
        </div>
        <p class="italic mb-2"><strong>Question:</strong> “${d.revenueOutlook.question}”</p>
        <p><strong>Answer:</strong> ${d.revenueOutlook.answer}</p>
        <p><strong>Why:</strong> ${d.revenueOutlook.why}</p>

        <div class="overflow-x-auto mt-4">
          <table class="min-w-full text-sm whitespace-nowrap">
            <thead class="table-header-sticky bg-[var(--background)] text-[var(--text-strong)]">
              <tr>
                <th class="py-2 px-4 font-semibold">Scenario</th>
                <th class="py-2 px-4 font-semibold">Students</th>
                <th class="py-2 px-4 font-semibold">Price</th>
                <th class="py-2 px-4 font-semibold text-right">12-Mo Revenue</th>
              </tr>
            </thead>
            <tbody id="scenarioTable" class="divide-y divide-[var(--border)]"></tbody>
          </table>
        </div>
      `,
      chart:'outlookChart',
    },
    {
      id:'verdict', icon:'check-circle', title:'8 · Conclusion',
      html: `
        <p class="italic mb-2"><strong>Question:</strong> “${d.buildDecision.question}”</p>
        <p><strong>Answer:</strong> ${d.buildDecision.answer}</p>
        <p><strong>Why:</strong> ${d.buildDecision.why}</p>
      `,
    }
  ];

  sectionsData.forEach(sec => {
    const content = template.content.cloneNode(true);
    const sectionEl = content.querySelector('section');
    sectionEl.id = sec.id;
    content.querySelector('.icon-wrap').innerHTML = icon(sec.icon);
    content.querySelector('.title').textContent = sec.title;
    content.querySelector('.section-body').innerHTML = sec.html;
    if(sec.chart) {
      content.querySelector('.section-chart-col').innerHTML = `<canvas id="${sec.chart}" class="max-w-full h-64" role="img"></canvas>`;
    } else {
      content.querySelector('.section-chart-col').remove();
    }
    main.appendChild(content);
  });

  // 5. KPI summary
  document.getElementById('kpiSummary').innerHTML = `
    <div>
      <div class="font-semibold">Demand</div>
      <div>${d.demand.score}/10</div>
    </div>
    <div>
      <div class="font-semibold">Target Price</div>
      <div>$${d.pricing.targetPriceUSD}</div>
    </div>
    <div>
      <div class="font-semibold">Likely 12-mo Rev</div>
      <div>$${d.revenueOutlook.likelyRevenueUSD}</div>
    </div>
    <div>
      <div class="font-semibold">Launch Time</div>
      <div>${d.revenueOutlook.launchTimelineDays} days</div>
    </div>
  `;

  // 6. Competitors & Scenarios
  const compTbody = document.getElementById('competitorTable');
  d.competitors.list.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-[var(--primary)]/5';
    tr.innerHTML = `
      <td class="py-2 px-4">${row.name}</td>
      <td class="py-2 px-4">${row.strengths}</td>
      <td class="py-2 px-4">${row.weaknesses}</td>
      <td class="py-2 px-4 text-right">$${row.priceUSD}</td>
    `;
    compTbody.appendChild(tr);
  });

  const scenarioTbody = document.getElementById('scenarioTable');
  d.revenueOutlook.scenarios.forEach(s => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-[var(--primary)]/5';
    tr.innerHTML = `
      <td class="py-2 px-4">${s.name}</td>
      <td class="py-2 px-4">${s.students.toLocaleString()}</td>
      <td class="py-2 px-4">$${s.priceUSD}</td>
      <td class="py-2 px-4 text-right">$${s.revenueUSD.toLocaleString()}</td>
    `;
    scenarioTbody.appendChild(tr);
  });

  // 7. Charts (fixed light colors)
  Chart.defaults.color       = '#475569';
  Chart.defaults.borderColor = '#cbd5e1';

  // Demand half-doughnut
  if(document.getElementById('scoreChart')){
    new Chart(scoreChart, {
      type:'doughnut',
      data: {
        labels:['Score','Remaining'],
        datasets:[{
          data:[ d.demand.score, (10 - d.demand.score) ],
          backgroundColor:[
            'var(--primary)',
            'var(--border)'
          ],
          borderWidth:0,
          cutout:'70%'
        }]
      },
      options:{
        rotation:-90,
        circumference:180,
        plugins:{
          legend:{display:false},
          tooltip:{enabled:false}
        }
      }
    });
  }

  // Market trends line
  if(document.getElementById('trendChart')) {
    new Chart(trendChart, {
      type:'line',
      data:{
        labels: d.trends.years ?? ['2019','2020','2021','2022','2023'],
        datasets:[{
          data: d.trends.index ?? [100,110,120,130,140],
          borderColor:'var(--primary)',
          fill:false,
          tension:0.35
        }]
      },
      options:{
        plugins:{legend:{display:false}},
        scales:{y:{ticks:{callback:v=>v+'%'}}}
      }
    });
  }

  // Ideal Pricing donut with center text
  if(document.getElementById('priceChart')){
    const centerTextPlugin = {
      id:'ct',
      afterDraw(c) {
        if(c.canvas.id!=='priceChart') return;
        const {ctx, chartArea:{left,right,top,bottom}} = c;
        ctx.save();
        ctx.font='600 24px Inter';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillStyle= '#111827';
        ctx.fillText('$'+d.pricing.targetPriceUSD, (left+right)/2, (top+bottom)/2);
        ctx.restore();
      }
    };
    Chart.register(centerTextPlugin);

    new Chart(priceChart, {
      type:'doughnut',
      data:{
        labels:['target',''],
        datasets:[{
          data:[ d.pricing.targetPriceUSD, 300 ],
          backgroundColor:[
            'var(--primary)',
            'var(--border)'
          ],
          borderWidth:0,
          cutout:'65%'
        }]
      },
      options:{
        plugins:{legend:{display:false}}
      }
    });
  }

  // Revenue outlook bar
  if(document.getElementById('outlookChart')){
    new Chart(outlookChart, {
      type:'bar',
      data:{
        labels: d.revenueOutlook.scenarios.map(s=>s.name),
        datasets:[
          {
            data: d.revenueOutlook.scenarios.map(s=>s.revenueUSD),
            backgroundColor:['#f87171','#fbbf24','#34d399'],
            borderRadius:6,
            borderSkipped:false
          }
        ]
      },
      options:{
        plugins:{
          legend:{display:false},
          annotation:{
            annotations:{
              avg:{
                type:'line',
                yMin:d.revenueOutlook.industryAverageUSD,
                yMax:d.revenueOutlook.industryAverageUSD,
                borderColor:'#475569',
                borderDash:[6,6],
                borderWidth:1.5,
                label:{
                  content:`Avg $${d.revenueOutlook.industryAverageUSD.toLocaleString()}`,
                  enabled:true,
                  color:'#fff',
                  backgroundColor:'rgba(0,0,0,.65)',
                  font:{style:'italic'},
                  yAdjust:-6
                }
              }
            }
          },
          tooltip:{
            callbacks:{label: ctx => '$'+ctx.parsed.y.toLocaleString()}
          }
        },
        scales:{
          y:{
            beginAtZero:true,
            ticks:{callback:v=>'$'+(v/1000)+'k'}
          }
        }
      }
    });
  }

  // 8. ScrollSpy
  const tocAnchors = [...document.querySelectorAll('#tocLinks a')];
  const watchSections = tocAnchors.map(a=>document.getElementById(a.hash.slice(1)));

  const spy = new IntersectionObserver(entries => {
    entries.forEach(ent=>{
      if(ent.isIntersecting) {
        tocAnchors.forEach(l=>l.classList.remove('text-[var(--primary)]','font-semibold'));
        const current = tocAnchors.find(l=>l.hash.slice(1) === ent.target.id);
        if(current) current.classList.add('text-[var(--primary)]','font-semibold');
      }
    });
  }, {rootMargin:'-35% 0px -50%'});

  watchSections.forEach(s=>spy.observe(s));

  // 9. Reveal on scroll
  const revealObs = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting) {
        e.target.classList.add('visible');
      }
    });
  },{ threshold:.1 });
  document.querySelectorAll('.reveal').forEach(el=>revealObs.observe(el));
}


/* ==========  React Audio Player  ========== */
(async()=>{
  await loadScript('https://unpkg.com/react@18/umd/react.production.min.js');
  await loadScript('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js');
  const {useRef,useState,useEffect} = React;

  const fmt = (t) => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;

  function Player() {
    const audioRef = useRef(null);
    const [play,setPlay] = useState(false);
    const [curr,setCurr] = useState(0);
    const [dur,setDur]   = useState(0);
    const [spd,setSpd]   = useState(1);

    useEffect(()=>{
      const audio = audioRef.current;
      const meta = ()=> setDur(audio.duration||0);
      const prog = ()=> setCurr(audio.currentTime||0);
      audio.addEventListener('loadedmetadata', meta);
      audio.addEventListener('timeupdate', prog);
      return()=>{
        audio.removeEventListener('loadedmetadata', meta);
        audio.removeEventListener('timeupdate', prog);
      }
    },[]);

    return React.createElement(
      'div',
      { className:'fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] w-[95%] max-w-3xl flex items-center gap-4 px-5 py-3 rounded-xl text-white bg-black/70 backdrop-blur shadow-brand ring-1 ring-white/10' },
      React.createElement(
        'button',
        {
          onClick: () => {
            const a=audioRef.current;
            if(play) a.pause(); else a.play();
            setPlay(!play);
          },
          className:'w-14 h-14 grid place-items-center rounded-full bg-[var(--primary)] shadow ring-1 ring-white/10'
        },
        React.createElement(
          'hero-icon-solid',
          { name: play ? 'pause' : 'play', class:'w-7 h-7' }
        )
      ),
      React.createElement(
        'div',
        { className:'flex-1' },
        React.createElement(
          'div',
          { className:'flex justify-between text-xs text-gray-200 mb-1' },
          React.createElement('span',null,'Market Research Summary'),
          React.createElement('span',null, fmt(curr)+' / '+fmt(dur))
        ),
        React.createElement('input',{
          type:'range',
          value: dur ? (curr/dur)*100 : 0,
          onChange: e=>{
            audioRef.current.currentTime = (e.target.value/100)*dur;
          },
          className:'w-full accent-[var(--primary)]'
        })
      ),
      React.createElement(
        'select',
        {
          value:spd,
          onChange: e=>{
            setSpd(e.target.value);
            audioRef.current.playbackRate = e.target.value;
          },
          className:'text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1'
        },
        [0.75,1,1.25,1.5,2].map(v=>React.createElement('option',{key:v,value:v},v+'x'))
      ),
      React.createElement('audio',{ref:audioRef,src:AUDIO_EXPLAINATION,preload:'metadata'})
    );
  }

  ReactDOM.createRoot(document.getElementById('react-root')).render(React.createElement(Player));
})();
  </script>

  <!-- Tiny chip utility + actionBtn classes (light only) -->
  <style>
    .chip {
      @apply px-3 py-1 rounded-full bg-[var(--border)] text-[var(--text-strong)];
    }
    .actionBtn {
      @apply bg-[var(--primary)] text-white px-4 py-2 rounded-full shadow-brand 
             hover:bg-[var(--primary)]/90 focus:ring-2 ring-[var(--primary)]/60 transition;
    }
  </style>
</body>
</html>
"""
# HTML_TEMPLATE = """

# <!DOCTYPE html>
# <html lang="en" class="scroll-smooth" data-theme="system">
# <head>
#   <meta charset="UTF-8" />
#   <meta name="viewport" content="width=device-width,initial-scale=1" />
#   <title id="pageTitle"></title>

#   <!-- Tailwind 3 – CDN build (JIT, darkMode=class) -->
#   <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
#   <script>
#     /* Minimal Tailwind config—no 'brand' extension. 
#        We'll rely on arbitrary color usage: e.g. bg-[var(--primary)] */
#     tailwind.config = {
#       darkMode: 'class',
#       theme: {
#         extend: {
#           boxShadow: {
#             brand:     '0 8px 28px rgba(0,0,0,.06), 0 2px 8px rgba(0,0,0,.04)',
#             brandDark: '0 8px 30px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.35)',
#           },
#         }
#       }
#     }
#   </script>

#   <!-- Fonts -->
#   <link rel="preconnect" href="https://fonts.gstatic.com" />
#   <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..800&display=swap" rel="stylesheet" />

#   <!-- Chart.js + plugins -->
#   <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" defer></script>
#   <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0" defer></script>
#   <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@1.4.0/dist/chartjs-plugin-annotation.min.js" defer></script>

#   <!-- Hero-icon-js -->
#   <script src="https://cdn.jsdelivr.net/npm/hero-icon-js/hero-icon-outline.min.js" defer></script>
#   <script src="https://cdn.jsdelivr.net/npm/hero-icon-js/hero-icon-solid.min.js" defer></script>

#   <style>
#     /* ========== 1. CSS Variables for Light & Dark ========== */
#     :root {
#       --light-bg:         #ffffff;
#       --light-primary:    #0a2540;
#       --light-text:       #1f2937;
#       --light-text2:      #4b5563;
#       --light-accent:     #3b82f6;
#       --light-border:     #e5e7eb;

#       /* Default to light mode until JS overrides them from courseData */
#       --background:       var(--light-bg);
#       --primary:          var(--light-primary);
#       --text-strong:      var(--light-text);
#       --text-soft:        var(--light-text2);
#       --accent:           var(--light-accent);
#       --border:           var(--light-border);
#     }
#     .dark {
#       --background:       var(--dark-bg, #0a2540);
#       --primary:          var(--dark-primary, #f6f9fc);
#       --text-strong:      var(--dark-text, #d1d5db);
#       --text-soft:        var(--dark-text2, #9ca3af);
#       --accent:           var(--dark-accent, #60a5fa);
#       --border:           var(--dark-border, #374151);
#     }

#     /* ========== 2. Base styles & utilities not in Tailwind ========== */
#     html {
#       font-family: 'Inter', system-ui, sans-serif;
#       background: var(--background);
#       color: var(--text-strong);
#     }
#     body {
#       min-height: 100vh;
#     }
#     ::selection {
#       background: var(--accent);
#       color: #fff;
#     }

#     /* Scrollbars */
#     ::-webkit-scrollbar {
#       width: 10px;
#       height: 10px;
#     }
#     ::-webkit-scrollbar-thumb {
#       background: var(--border);
#       border-radius: 8px;
#     }

#     /* Reveal-on-scroll */
#     .reveal {
#       opacity: 0;
#       transform: translateY(28px);
#       transition: opacity .6s, transform .6s;
#     }
#     .reveal.visible {
#       opacity: 1;
#       transform: none;
#     }

#     /* Sticky table header on ≥lg */
#     @media (min-width:1024px) {
#       thead.table-header-sticky {
#         position: sticky; 
#         top: 0; 
#         backdrop-filter: blur(8px);
#       }
#     }
#   </style>
# </head>

# <body class="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] antialiased">

#   <!-- Skip link for accessibility -->
#   <a href="#content" class="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 bg-[var(--primary)] text-white rounded px-3 py-1 z-50">
#     Skip to content
#   </a>

#   <!-- ───────────────────────  SIDEBAR  ─────────────────────── -->
#   <aside id="toc"
#     class="hidden lg:block sticky top-0 h-screen overflow-y-auto border-r 
#            border-[var(--border)] bg-[var(--background)] p-6 z-30"
#     aria-label="Table of contents">
#     <header class="flex justify-between items-center mb-6">
#       <h2 class="uppercase tracking-wide font-semibold text-xs text-[var(--text-soft)]">
#         On this page
#       </h2>
#       <!-- Theme toggle button -->
#       <button id="themeToggle" aria-label="Toggle dark mode"
#         class="text-[var(--text-soft)] hover:text-[var(--primary)] p-1 rounded focus:ring-2 ring-[var(--primary)]">
#         <hero-icon-outline name="moon" class="w-5 h-5 dark:hidden"></hero-icon-outline>
#         <hero-icon-outline name="sun"  class="w-5 h-5 hidden dark:inline"></hero-icon-outline>
#       </button>
#     </header>
#     <nav id="tocLinks" class="space-y-2 leading-6 text-sm"></nav>
#   </aside>

#   <!-- ───────────────────────  MAIN  ─────────────────────── -->
#   <main id="content" class="px-4 sm:px-6 py-14">
#     <!-- HERO / HEADER -->
#     <header
#       class="relative rounded-xl mb-8 reveal visible overflow-hidden
#              bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/70 text-white 
#              shadow-brand dark:shadow-brandDark">
#       <div class="px-6 py-14 sm:py-20 text-center">
#         <h1 id="courseTitle" class="text-4xl sm:text-5xl font-extrabold"></h1>
#         <p id="reportSubtitle" class="mt-4 text-lg/relaxed text-white/90"></p>
#       </div>
#       <span id="opportunityScore"
#         class="absolute top-4 right-4 sm:right-8 bg-black/10 dark:bg-white/10 
#                backdrop-blur px-4 py-1 rounded-full text-sm font-semibold">
#       </span>
#     </header>

#     <!-- KPI SUMMARY -->
#     <section id="kpiSummary"
#       class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-sm mb-10
#              bg-[var(--background)] shadow-brand ring-1 ring-black/5 dark:ring-white/10 
#              rounded-xl p-5 reveal">
#     </section>

#     <!-- Nav (hamburger) for mobile -->
#     <button id="tocToggle"
#       class="lg:hidden fixed bottom-20 right-6 z-[60] bg-[var(--primary)] text-white p-3 
#              rounded-full shadow-brandDark focus:ring-4 ring-[var(--primary)]/50"
#       aria-controls="toc" aria-expanded="false">
#       <hero-icon-outline name="bars-3" class="w-6 h-6"></hero-icon-outline>
#     </button>

#     <!-- Template for dynamic sections -->
#     <template id="sectionTemplate">
#       <section
#         class="reveal mb-14 rounded-xl ring-1 ring-black/5 dark:ring-white/10 shadow-brand 
#                bg-[var(--background)] lg:grid lg:grid-cols-[minmax(0,680px)_1fr] 
#                lg:gap-12 p-8 space-y-6">
#         <div>
#           <div class="flex items-center gap-3 mb-4">
#             <span class="icon-wrap shrink-0"></span>
#             <h2 class="title text-2xl font-bold tracking-tight text-[var(--primary)]"></h2>
#           </div>
#           <div class="section-body prose max-w-none dark:prose-invert"></div>
#         </div>
#         <div class="section-chart-col flex items-center justify-center mt-4 lg:mt-0"></div>
#       </section>
#     </template>

#     <!-- Final verdict placeholder (will be populated via JS) -->
#     <section id="verdict" class="hidden"></section>
#   </main>

#   <!-- Desktop CTA (Back-to-top) -->
#   <div id="ctaBar"
#     class="hidden lg:flex fixed bottom-6 right-6 items-center gap-4
#            bg-[var(--primary)] text-white px-6 py-3 rounded-full shadow-brandDark z-[55]">
#     <button class="font-semibold hover:bg-white/10 px-3 py-1 rounded focus:ring-2 ring-inset ring-white/60"
#             onclick="window.scrollTo({top:0,behavior:'smooth'})">↑ Top</button>
#   </div>

#   <!-- ───────────────────────  AUDIO BAR w/ React  ─────────────────────── -->
#   <div id="react-root"></div>

#   <!-- ───────────────────────  SCRIPTS  ─────────────────────── -->
#   <script>
# /* -----------------------------------------------------------
#    Helper: loadScript(url)  (returns Promise)
# ------------------------------------------------------------*/
# function loadScript(url) {
#   return new Promise((resolve, reject) => {
#     const s = document.createElement('script');
#     s.src = url;
#     s.onload = resolve;
#     s.onerror = () => reject(new Error('Failed to load ' + url));
#     document.head.appendChild(s);
#   });
# }

# /* -----------------------------------------------------------
#    Heroicon helper
# ------------------------------------------------------------*/
# function icon(name, cls='w-6 h-6 text-[var(--primary)]'){
#   return `<hero-icon-outline name="${name}" class="${cls}"></hero-icon-outline>`;
# }

# /* -----------------------------------------------------------
#    THEME: detect system, allow user toggle
# ------------------------------------------------------------*/
# const themeStorageKey = 'market-theme';
# const root = document.documentElement;

# function applyTheme(mode) {
#   if(mode === 'dark') {
#     root.classList.add('dark');
#   } else {
#     root.classList.remove('dark');
#   }
#   root.dataset.theme = mode;
#   localStorage.setItem(themeStorageKey, mode);
# }

# (function initTheme(){
#   const saved = localStorage.getItem(themeStorageKey);
#   if(saved) {
#     applyTheme(saved);
#   } else if(window.matchMedia('(prefers-color-scheme:dark)').matches) {
#     applyTheme('dark');
#   } else {
#     applyTheme('light');
#   }
#   document.getElementById('themeToggle').addEventListener('click', () => {
#     applyTheme(root.classList.contains('dark') ? 'light' : 'dark');
#   });
# })();

# /* -----------------------------------------------------------
#    Load external COURSE DATA script, then build UI
#    Replace CUSTOM_VALUES_MARKET_RESEARCH_REPORT with your script URL
# ------------------------------------------------------------*/
# document.addEventListener('DOMContentLoaded', async () => {
#   try {
#     await loadScript(CUSTOM_VALUES_MARKET_RESEARCH_REPORT); // Must define window.courseData
#     buildPage();
#   } catch (e) {
#     console.error(e);
#   }
# });

# /* -----------------------------------------------------------
#    Apply brandColors for both light & dark from courseData
# ------------------------------------------------------------*/
# function applyBrandColors(bc) {
#   // bc.lightMode and bc.darkMode must exist
#   // Set :root --light-* variables
#   root.style.setProperty('--light-bg',         bc.lightMode.background     || '#ffffff');
#   root.style.setProperty('--light-primary',    bc.lightMode.primary       || '#0a2540');
#   root.style.setProperty('--light-text',       bc.lightMode.text          || '#1f2937');
#   root.style.setProperty('--light-text2',      bc.lightMode.textSecondary || '#4b5563');
#   root.style.setProperty('--light-accent',     bc.lightMode.accent        || '#3b82f6');
#   root.style.setProperty('--light-border',     bc.lightMode.border        || '#e5e7eb');

#   // Set .dark overrides
#   root.style.setProperty('--dark-bg',          bc.darkMode.background     || '#0a2540');
#   root.style.setProperty('--dark-primary',     bc.darkMode.primary        || '#f6f9fc');
#   root.style.setProperty('--dark-text',        bc.darkMode.text           || '#d1d5db');
#   root.style.setProperty('--dark-text2',       bc.darkMode.textSecondary  || '#9ca3af');
#   root.style.setProperty('--dark-accent',      bc.darkMode.accent         || '#60a5fa');
#   root.style.setProperty('--dark-border',      bc.darkMode.border         || '#374151');
# }

# function buildPage() {
#   if (!window.courseData) {
#     return console.error('courseData missing');
#   }
#   const d = window.courseData;

#   // 1. Apply brandColors
#   if(d.brandColors) {
#     applyBrandColors(d.brandColors);
#   }

#   // 2. Title & header info
#   const pageTitle = `${d.meta.courseTitle} · ${d.meta.reportTitle}`;
#   document.title = pageTitle;
#   document.getElementById('pageTitle').textContent = pageTitle;
#   document.getElementById('courseTitle').textContent = d.meta.courseTitle;
#   document.getElementById('reportSubtitle').textContent = d.meta.reportTitle;
#   document.getElementById('opportunityScore').textContent = `Score ${d.opportunityScore}/100`;

#   // 3. TOC setup
#   const tocData = [
#     ['worthIt','Should You Make It?','light-bulb'],
#     ['overview','Course Overview','book-open'],
#     ['trends','Market Trends','chart-bar'],
#     ['competitors','Competition','users'],
#     ['worries','Learner Concerns','exclamation-triangle'],
#     ['pricing','Ideal Pricing','currency-dollar'],
#     ['outlook','Revenue Outlook','chart-pie'],
#     ['verdict','Conclusion','check-circle']
#   ];
#   const tocLinks = document.getElementById('tocLinks');
#   tocData.forEach(([id,label,heroIcon]) => {
#     const a = document.createElement('a');
#     a.href = '#'+id;
#     a.className = 'block px-3 py-1 rounded hover:text-[var(--primary)] transition-colors';
#     a.innerHTML = label;
#     tocLinks.appendChild(a);
#   });

#   // hamburger toggle
#   const tocDrawer = document.getElementById('toc');
#   const tocToggle = document.getElementById('tocToggle');
#   tocToggle.onclick = () => {
#     tocDrawer.classList.toggle('hidden');
#     const expanded = !tocDrawer.classList.contains('hidden');
#     tocToggle.setAttribute('aria-expanded', expanded);
#   };

#   // 4. Build dynamic sections
#   const main = document.querySelector('main');
#   const template = document.getElementById('sectionTemplate');

#   const sectionsData = [
#     {
#       id:'worthIt', icon:'light-bulb', title:'1 · Should You Make It?',
#       html: `
#         <div class="flex flex-wrap gap-2 text-sm mb-6">
#           <span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 
#                        dark:bg-emerald-800/30 dark:text-emerald-200">
#             Demand Score <strong>${d.demand.score}/10</strong>
#           </span>
#           <span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 
#                        dark:bg-blue-800/30 dark:text-blue-200">
#             Top <strong>${d.demand.percentile}%</strong>
#           </span>
#         </div>
#         <p class="italic mb-2"><strong>Question:</strong> “${d.demand.question}”</p>
#         <p><strong>Answer:</strong> ${d.demand.answer}</p>
#         <p><strong>Why:</strong> ${d.demand.why}</p>
#       `,
#       chart:'scoreChart',
#     },
#     {
#       id:'overview', icon:'book-open', title:'2 · Course Overview',
#       html: `
#         <div class="flex flex-wrap gap-2 text-sm mb-4">
#           <span class="chip">Overview:&nbsp;<strong>${d.testing.overview}</strong></span>
#           <span class="chip">Audience:&nbsp;<strong>${d.testing.targetAudience}</strong></span>
#           <span class="chip">Format:&nbsp;<strong>${d.testing.format}</strong></span>
#         </div>
#         <p class="italic mb-2"><strong>Question:</strong> “${d.testing.question}”</p>
#         <p><strong>Answer:</strong> ${d.testing.answer}</p>
#         <p><strong>Why:</strong> ${d.testing.why}</p>
#         <ul class="list-disc list-inside grid sm:grid-cols-2 gap-x-6 mt-4 text-sm">
#           ${ d.testing.contentPillars.map(p=>`<li>${p}</li>`).join('') }
#         </ul>
#       `,
#     },
#     {
#       id:'trends', icon:'chart-bar', title:'3 · Market Trends',
#       html: `
#         <div class="flex flex-wrap gap-2 text-sm mb-4">
#           <span class="chip bg-emerald-100 text-emerald-800 
#                        dark:bg-emerald-800/30 dark:text-emerald-200">
#             Google +${d.trends.googleSearchChangePct}%
#           </span>
#           <span class="chip bg-cyan-100 text-cyan-800 
#                        dark:bg-cyan-800/30 dark:text-cyan-200">
#             Social +${d.trends.socialMediaGrowthPct}%
#           </span>
#           <span class="chip">${d.trends.macroFactor}</span>
#         </div>
#         <p class="italic mb-2"><strong>Question:</strong> “${d.trends.question}”</p>
#         <p><strong>Answer:</strong> ${d.trends.answer}</p>
#         <p><strong>Why:</strong> ${d.trends.why}</p>
#       `,
#       chart:'trendChart',
#     },
#     {
#       id:'competitors', icon:'users', title:'4 · Competition',
#       html: `
#         <p class="italic mb-2"><strong>Question:</strong> “${d.competitors.question}”</p>
#         <p><strong>Answer:</strong> ${d.competitors.answer}</p>
#         <p><strong>Why:</strong> ${d.competitors.why}</p>
#         <div class="overflow-x-auto mt-4">
#           <table class="min-w-full text-sm whitespace-nowrap">
#             <thead class="table-header-sticky bg-[var(--background)] text-[var(--text-strong)]">
#               <tr>
#                 <th class="py-2 px-4 font-semibold">Resource</th>
#                 <th class="py-2 px-4 font-semibold">Strengths</th>
#                 <th class="py-2 px-4 font-semibold">Weaknesses</th>
#                 <th class="py-2 px-4 font-semibold text-right">Price</th>
#               </tr>
#             </thead>
#             <tbody id="competitorTable" class="divide-y divide-[var(--border)]"></tbody>
#           </table>
#         </div>
#       `,
#     },
#     {
#       id:'worries', icon:'exclamation-triangle', title:'5 · Learner Concerns',
#       html: `
#         <p class="italic mb-2"><strong>Question:</strong> “${d.worries.question}”</p>
#         <p><strong>Answer:</strong> ${d.worries.answer}</p>
#         <p><strong>Why:</strong> ${d.worries.why}</p>
#         <ul class="list-disc list-inside grid sm:grid-cols-2 gap-x-6 mt-4 text-sm">
#           ${ d.worries.topConcerns.map(c=>`<li>${c}</li>`).join('') }
#         </ul>
#       `,
#     },
#     {
#       id:'pricing', icon:'currency-dollar', title:'6 · Ideal Pricing',
#       html: `
#         <p class="italic mb-2"><strong>Question:</strong> “${d.pricing.question}”</p>
#         <p><strong>Answer:</strong> ${d.pricing.answer}</p>
#         <p><strong>Why:</strong> ${d.pricing.why}</p>
#       `,
#       chart:'priceChart',
#     },
#     {
#       id:'outlook', icon:'chart-pie', title:'7 · Revenue Outlook',
#       html: `
#         <div class="flex flex-wrap gap-2 text-sm mb-4">
#           <span class="chip bg-emerald-100 text-emerald-800 
#                        dark:bg-emerald-800/30 dark:text-emerald-200">
#             Likely $${d.revenueOutlook.likelyRevenueUSD}
#           </span>
#           <span class="chip bg-blue-100 text-blue-800 
#                        dark:bg-blue-800/30 dark:text-blue-200">
#             vs $${d.revenueOutlook.industryAverageUSD} avg
#           </span>
#           <span class="chip bg-purple-100 text-purple-800 
#                        dark:bg-purple-800/30 dark:text-purple-200">
#             Launch in ${d.revenueOutlook.launchTimelineDays} days
#           </span>
#         </div>
#         <p class="italic mb-2"><strong>Question:</strong> “${d.revenueOutlook.question}”</p>
#         <p><strong>Answer:</strong> ${d.revenueOutlook.answer}</p>
#         <p><strong>Why:</strong> ${d.revenueOutlook.why}</p>

#         <div class="overflow-x-auto mt-4">
#           <table class="min-w-full text-sm whitespace-nowrap">
#             <thead class="table-header-sticky bg-[var(--background)] text-[var(--text-strong)]">
#               <tr>
#                 <th class="py-2 px-4 font-semibold">Scenario</th>
#                 <th class="py-2 px-4 font-semibold">Students</th>
#                 <th class="py-2 px-4 font-semibold">Price</th>
#                 <th class="py-2 px-4 font-semibold text-right">12-Mo Revenue</th>
#               </tr>
#             </thead>
#             <tbody id="scenarioTable" class="divide-y divide-[var(--border)]"></tbody>
#           </table>
#         </div>
#       `,
#       chart:'outlookChart',
#     },
#     {
#       id:'verdict', icon:'check-circle', title:'8 · Conclusion',
#       html: `
#         <p class="italic mb-2"><strong>Question:</strong> “${d.buildDecision.question}”</p>
#         <p><strong>Answer:</strong> ${d.buildDecision.answer}</p>
#         <p><strong>Why:</strong> ${d.buildDecision.why}</p>

#         <div class="mt-6 flex flex-wrap gap-3">
#           <button class="actionBtn">Build Outline</button>
#           <button class="actionBtn">Revise Course</button>
#           <button class="actionBtn">Compare Topics</button>
#         </div>
#       `,
#     }
#   ];

#   sectionsData.forEach(sec => {
#     const content = template.content.cloneNode(true);
#     const sectionEl = content.querySelector('section');
#     sectionEl.id = sec.id;
#     content.querySelector('.icon-wrap').innerHTML = icon(sec.icon);
#     content.querySelector('.title').textContent = sec.title;
#     content.querySelector('.section-body').innerHTML = sec.html;
#     if(sec.chart) {
#       content.querySelector('.section-chart-col').innerHTML = `<canvas id="${sec.chart}" class="max-w-full h-64" role="img"></canvas>`;
#     } else {
#       content.querySelector('.section-chart-col').remove();
#     }
#     main.appendChild(content);
#   });

#   // 5. KPI summary
#   document.getElementById('kpiSummary').innerHTML = `
#     <div>
#       <div class="font-semibold">Demand</div>
#       <div>${d.demand.score}/10</div>
#     </div>
#     <div>
#       <div class="font-semibold">Target Price</div>
#       <div>$${d.pricing.targetPriceUSD}</div>
#     </div>
#     <div>
#       <div class="font-semibold">Likely 12-mo Rev</div>
#       <div>$${d.revenueOutlook.likelyRevenueUSD}</div>
#     </div>
#     <div>
#       <div class="font-semibold">Launch Time</div>
#       <div>${d.revenueOutlook.launchTimelineDays} days</div>
#     </div>
#   `;

#   // 6. Competitors / Scenarios
#   const compTbody = document.getElementById('competitorTable');
#   d.competitors.list.forEach(row => {
#     const tr = document.createElement('tr');
#     tr.className = 'hover:bg-[var(--primary)]/5 dark:hover:bg-[var(--primary)]/10';
#     tr.innerHTML = `
#       <td class="py-2 px-4">${row.name}</td>
#       <td class="py-2 px-4">${row.strengths}</td>
#       <td class="py-2 px-4">${row.weaknesses}</td>
#       <td class="py-2 px-4 text-right">$${row.priceUSD}</td>
#     `;
#     compTbody.appendChild(tr);
#   });

#   const scenarioTbody = document.getElementById('scenarioTable');
#   d.revenueOutlook.scenarios.forEach(s => {
#     const tr = document.createElement('tr');
#     tr.className = 'hover:bg-[var(--primary)]/5 dark:hover:bg-[var(--primary)]/10';
#     tr.innerHTML = `
#       <td class="py-2 px-4">${s.name}</td>
#       <td class="py-2 px-4">${s.students.toLocaleString()}</td>
#       <td class="py-2 px-4">$${s.priceUSD}</td>
#       <td class="py-2 px-4 text-right">$${s.revenueUSD.toLocaleString()}</td>
#     `;
#     scenarioTbody.appendChild(tr);
#   });

#   // 7. Charts (auto theme aware)
#   const darkMode = root.classList.contains('dark');
#   Chart.defaults.color        = darkMode ? '#cbd5e1' : '#475569';
#   Chart.defaults.borderColor  = darkMode ? '#334155' : '#cbd5e1';

#   // Demand half-doughnut
#   if(document.getElementById('scoreChart')){
#     new Chart(scoreChart, {
#       type:'doughnut',
#       data: {
#         labels:['Score','Remaining'],
#         datasets:[{
#           data:[ d.demand.score, (10 - d.demand.score) ],
#           backgroundColor:[
#             'var(--primary)',
#             'var(--border)'
#           ],
#           borderWidth:0,
#           cutout:'70%'
#         }]
#       },
#       options:{
#         rotation:-90,
#         circumference:180,
#         plugins:{
#           legend:{display:false},
#           tooltip:{enabled:false}
#         }
#       }
#     });
#   }

#   // Market trends line
#   if(document.getElementById('trendChart')) {
#     new Chart(trendChart, {
#       type:'line',
#       data:{
#         labels: d.trends.years ?? ['2019','2020','2021','2022','2023'],
#         datasets:[{
#           data: d.trends.index ?? [100,110,120,130,140],
#           borderColor:'var(--primary)',
#           fill:false,
#           tension:0.35
#         }]
#       },
#       options:{
#         plugins:{legend:{display:false}},
#         scales:{y:{ticks:{callback:v=>v+'%'}}}
#       }
#     });
#   }

#   // Ideal Pricing donut with center text
#   if(document.getElementById('priceChart')){
#     const centerTextPlugin = {
#       id:'ct',
#       afterDraw(c) {
#         if(c.canvas.id!=='priceChart') return;
#         const {ctx, chartArea:{left,right,top,bottom}} = c;
#         ctx.save();
#         ctx.font='600 24px Inter';
#         ctx.textAlign='center';
#         ctx.textBaseline='middle';
#         ctx.fillStyle= darkMode ? '#f9fafb' : '#111827';
#         ctx.fillText('$'+d.pricing.targetPriceUSD, (left+right)/2, (top+bottom)/2);
#         ctx.restore();
#       }
#     };
#     Chart.register(centerTextPlugin);

#     new Chart(priceChart, {
#       type:'doughnut',
#       data:{
#         labels:['target',''],
#         datasets:[{
#           data:[ d.pricing.targetPriceUSD, 300 ],
#           backgroundColor:[
#             'var(--primary)',
#             'var(--border)'
#           ],
#           borderWidth:0,
#           cutout:'65%'
#         }]
#       },
#       options:{
#         plugins:{legend:{display:false}}
#       }
#     });
#   }

#   // Revenue outlook bar
#   if(document.getElementById('outlookChart')){
#     new Chart(outlookChart, {
#       type:'bar',
#       data:{
#         labels: d.revenueOutlook.scenarios.map(s=>s.name),
#         datasets:[
#           {
#             data: d.revenueOutlook.scenarios.map(s=>s.revenueUSD),
#             backgroundColor:['#f87171','#fbbf24','#34d399'],
#             borderRadius:6,
#             borderSkipped:false
#           }
#         ]
#       },
#       options:{
#         plugins:{
#           legend:{display:false},
#           annotation:{
#             annotations:{
#               avg:{
#                 type:'line',
#                 yMin:d.revenueOutlook.industryAverageUSD,
#                 yMax:d.revenueOutlook.industryAverageUSD,
#                 borderColor: darkMode ? '#64748b' : '#475569',
#                 borderDash:[6,6],
#                 borderWidth:1.5,
#                 label:{
#                   content:`Avg $${d.revenueOutlook.industryAverageUSD.toLocaleString()}`,
#                   enabled:true,
#                   color:'#fff',
#                   backgroundColor:'rgba(0,0,0,.65)',
#                   font:{style:'italic'},
#                   yAdjust:-6
#                 }
#               }
#             }
#           },
#           tooltip:{
#             callbacks:{label: ctx => '$'+ctx.parsed.y.toLocaleString()}
#           }
#         },
#         scales:{
#           y:{
#             beginAtZero:true,
#             ticks:{callback:v=>'$'+(v/1000)+'k'}
#           }
#         }
#       }
#     });
#   }

#   // 8. ScrollSpy
#   const tocAnchors = [...document.querySelectorAll('#tocLinks a')];
#   const watchSections = tocAnchors.map(a=>document.getElementById(a.hash.slice(1)));

#   const spy = new IntersectionObserver(entries => {
#     entries.forEach(ent=>{
#       if(ent.isIntersecting) {
#         tocAnchors.forEach(l=>l.classList.remove('text-[var(--primary)]','font-semibold'));
#         const current = tocAnchors.find(l=>l.hash.slice(1) === ent.target.id);
#         if(current) current.classList.add('text-[var(--primary)]','font-semibold');
#       }
#     });
#   }, {rootMargin:'-35% 0px -50%'});

#   watchSections.forEach(s=>spy.observe(s));

#   // 9. Reveal on scroll
#   const revealObs = new IntersectionObserver(entries=>{
#     entries.forEach(e=>{
#       if(e.isIntersecting) {
#         e.target.classList.add('visible');
#       }
#     });
#   },{ threshold:.1 });
#   document.querySelectorAll('.reveal').forEach(el=>revealObs.observe(el));
# }


# /* ==========  React Audio Player  ========== */
# (async()=>{
#   await loadScript('https://unpkg.com/react@18/umd/react.production.min.js');
#   await loadScript('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js');
#   const {useRef,useState,useEffect} = React;

#   const fmt = (t) => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;

#   function Player() {
#     const audioRef = useRef(null);
#     const [play,setPlay] = useState(false);
#     const [curr,setCurr] = useState(0);
#     const [dur,setDur]   = useState(0);
#     const [spd,setSpd]   = useState(1);

#     useEffect(()=>{
#       const audio = audioRef.current;
#       const meta = ()=> setDur(audio.duration||0);
#       const prog = ()=> setCurr(audio.currentTime||0);
#       audio.addEventListener('loadedmetadata', meta);
#       audio.addEventListener('timeupdate', prog);
#       return()=>{
#         audio.removeEventListener('loadedmetadata', meta);
#         audio.removeEventListener('timeupdate', prog);
#       }
#     },[]);

#     return React.createElement(
#       'div',
#       { className:'fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] w-[95%] max-w-3xl flex items-center gap-4 px-5 py-3 rounded-xl text-white bg-black/70 backdrop-blur shadow-brandDark ring-1 ring-white/10' },
#       React.createElement(
#         'button',
#         {
#           onClick: () => {
#             const a=audioRef.current;
#             if(play) a.pause(); else a.play();
#             setPlay(!play);
#           },
#           className:'w-14 h-14 grid place-items-center rounded-full bg-[var(--primary)] shadow ring-1 ring-white/10'
#         },
#         React.createElement(
#           'hero-icon-solid',
#           { name: play ? 'pause' : 'play', class:'w-7 h-7' }
#         )
#       ),
#       React.createElement(
#         'div',
#         { className:'flex-1' },
#         React.createElement(
#           'div',
#           { className:'flex justify-between text-xs text-gray-200 mb-1' },
#           React.createElement('span',null,'Market Research Summary'),
#           React.createElement('span',null, fmt(curr)+' / '+fmt(dur))
#         ),
#         React.createElement('input',{
#           type:'range',
#           value: dur ? (curr/dur)*100 : 0,
#           onChange: e=>{
#             audioRef.current.currentTime = (e.target.value/100)*dur;
#           },
#           className:'w-full accent-[var(--primary)]'
#         })
#       ),
#       React.createElement(
#         'select',
#         {
#           value:spd,
#           onChange: e=>{
#             setSpd(e.target.value);
#             audioRef.current.playbackRate = e.target.value;
#           },
#           className:'text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1'
#         },
#         [0.75,1,1.25,1.5,2].map(v=>React.createElement('option',{key:v,value:v},v+'x'))
#       ),
#       React.createElement('audio',{ref:audioRef,src:AUDIO_EXPLAINATION,preload:'metadata'})
#     );
#   }

#   ReactDOM.createRoot(document.getElementById('react-root')).render(React.createElement(Player));
# })();
#   </script>

#   <!-- Tiny chip utility + actionBtn classes -->
#   <style>
#     .chip {
#       @apply px-3 py-1 rounded-full bg-[var(--border)] text-[var(--text-strong)] 
#              dark:bg-white/5 dark:text-[var(--text-soft)];
#     }
#     .actionBtn {
#       @apply bg-[var(--primary)] text-white px-4 py-2 rounded-full shadow-brandDark 
#              hover:bg-[var(--primary)]/90 focus:ring-2 ring-[var(--primary)]/60 transition;
#     }
#   </style>
# </body>
# </html>
# """
COUNTDOWN_SCRIPT = r"""
<!-- START: 24-Hour Countdown + Stripe + Hyros Tracking + Stylish Bottom Audio Bar -->
<script>
(async function() {
  // Utility: load external JS
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load script ${src}`));
      document.head.appendChild(s);
    });
  }

  // Show minimal loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.id = 'loading-indicator';
  loadingIndicator.textContent = 'Loading...';
  Object.assign(loadingIndicator.style, {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    zIndex: '999999', fontSize: '18px', fontWeight: 'bold',
    backgroundColor: '#fff', padding: '15px', borderRadius: '5px'
  });
  document.body.appendChild(loadingIndicator);

  // Load Stripe
  await loadScript('https://js.stripe.com/v3/');

  const fallbackUrl = "https://checkout.coursecreator360.com/b/dR6cNB7Im6N85IA9AF";
  let stripe = (typeof Stripe === 'function')
    ? Stripe("pk_live_51LNznbBnnqL8bKFQDpqXsQJ00WefQSSLMf2CZWr0sarinvaalkyY0BE7q7swLzIt49RSiCgBAP5uPHjU8fBNDsf0008MSXCQFU")
    : null;
  let sessionId = null;

  // Try to fetch a Checkout Session
  try {
    const params = new URLSearchParams(window.location.search);
    const aiWebsiteId = params.get("ai_website_id");
    const body = aiWebsiteId ? { ai_website_id: aiWebsiteId } : {};
    const res = await fetch("https://3k62eq3mjyecfujkgbmrophvwq0xigra.lambda-url.us-west-2.on.aws/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed to fetch Checkout Session");
    const data = await res.json();
    sessionId = data.clientSecret;
  } catch (err) {
    console.error("Error fetching Stripe session:", err);
  }

  // Remove loading indicator
  loadingIndicator.remove();

  // Create top banner
  const banner = document.createElement('div');
  banner.id = 'banner';
  banner.className = 'fixed top-0 w-full bg-blue-50 text-blue-700 text-center p-2 z-50 text-xs';
  banner.innerHTML = `
    <span id="banner-text" class="inline-block">
      If you would like a free course outline generated inside your account, please sign up for a 30-day free trial in the next 24 hours.
    </span>
    <span class="ml-2">
      Time remaining:
      <span id="countdown" class="font-bold">24:00:00</span>
    </span>
    <button id="signup-button" class="bg-blue-500 text-white font-bold py-1 px-2 ml-2 rounded hover:bg-blue-700 text-xs">
      Sign Up
    </button>
  `;
  document.body.appendChild(banner);

  // Create expiration overlay
  const expirationOverlay = document.createElement('div');
  Object.assign(expirationOverlay.style, {
    position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
    display: 'none', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)', textAlign: 'center', padding: '20px'
  });
  const expirationText = document.createElement('p');
  expirationText.className = 'text-lg font-bold';
  expirationText.textContent = "Time is up. If you'd still like a free course outline, sign up for a free trial.";
  const expirationButton = document.createElement('button');
  expirationButton.id = 'expiration-signup-button';
  expirationButton.className = 'bg-blue-500 text-white font-bold py-2 px-4 mt-4 rounded hover:bg-blue-700';
  expirationButton.textContent = 'Sign Up';
  expirationOverlay.appendChild(expirationText);
  expirationOverlay.appendChild(expirationButton);
  document.body.appendChild(expirationOverlay);

  // Fetch expiry from backend
  async function checkExpiry() {
    const params = new URLSearchParams(window.location.search);
    const marketId = params.get("temp_market_research_id");
    if (!marketId) return;
    try {
      const res = await fetch("https://yrlgfq2deombfvebn4bbdz4bve0ecnfp.lambda-url.us-west-2.on.aws/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temp_market_research_id: marketId })
      });
      const data = await res.json();
      if (res.ok) {
        startCountdown(data.hours * 3600 + data.minutes * 60 + data.seconds);
      } else {
        console.error("Error fetching expiry:", data.message);
      }
    } catch (e) {
      console.error("checkExpiry error:", e);
    }
  }

  function startCountdown(duration) {
    const el = document.getElementById('countdown');
    let timer = duration;
    const iv = setInterval(() => {
      const h = String(Math.floor(timer / 3600)).padStart(2, '0');
      const m = String(Math.floor((timer % 3600) / 60)).padStart(2, '0');
      const s = String(timer % 60).padStart(2, '0');
      el.textContent = `${h}:${m}:${s}`;
      if (--timer < 0) {
        clearInterval(iv);
        document.body.innerHTML = '';
        document.body.appendChild(expirationOverlay);
        expirationOverlay.style.display = 'flex';
        if (stripe && sessionId) {
          stripe.redirectToCheckout({ sessionId });
        } else {
          window.location.href = fallbackUrl;
        }
      }
    }, 1000);
  }

  // Hook up sign-up button
  document.getElementById('signup-button').onclick = () => {
    if (stripe && sessionId) stripe.redirectToCheckout({ sessionId });
    else window.location.href = fallbackUrl;
  };
  expirationButton.onclick = document.getElementById('signup-button').onclick;

  // Hide banner text on scroll
  window.addEventListener('scroll', () => {
    document.getElementById('banner-text').style.display =
      window.scrollY > 0 ? 'none' : 'inline-block';
  });

  // Kick off countdown
  await checkExpiry();

  // (Optional) HYROS tracking snippet would go here
})();
</script>
"""