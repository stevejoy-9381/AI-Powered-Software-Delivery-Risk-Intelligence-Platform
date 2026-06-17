# Demo Script — DeliveryRisk AI Platform

This script guides you through a complete end-to-end demonstration of the DeliveryRisk AI platform, highlighting the machine learning and analytics features.

---

## 🚪 Step 1: Authentication & Onboarding

1. Open http://localhost:3000 in your browser.
2. You will be greeted by a premium dark login portal.
3. Use the pre-seeded credentials at the bottom of the card:
   - **Email:** `admin@demo.com`
   - **Password:** `Demo@123`
4. Click **Sign In**.

---

## 📊 Step 2: The Command Center (Dashboard)

1. You are logged into the main **Dashboard**.
2. Notice the real-time summary stat cards showing:
   - **Active Sprints** currently in progress.
   - **Sprints At Risk** (high/critical scores).
   - **On Track** sprints.
   - **Average Health Score** across the entire organization.
3. The **Risk Distribution** donut chart segments sprints into risk levels. Hover over segments to see details.
4. Under **Sprint Risk Overview**, you will see a list of sprints sorted by risk.
5. Under **Teams at a Glance**, click on a team (e.g. `Platform Core`) to view the team roster page.

---

## 📅 Step 3: Sprint Risk Breakdown & Explainability

1. Navigate to a sprint by clicking on one in the **Sprint Risk Overview** table.
2. In the **Sprint Detail** view, you will see:
   - The large **Risk Gauge** showing the model's delay probability score.
   - **Risk Factors**: Explanations highlighting why the model flagged this sprint (e.g. scope creep, review lag).
   - **Pull Requests** table: Shows additions/deletions and review lag.
     - Click on a PR to open the **AI Side Panel**.
     - Review the **AI Summary** which gives a paragraph analysis of changes and security/auth flags.
   - **Commit Activity** line chart: Tracks developer check-in frequency over time.
   - **Staffing Signals**: Identifies bottleneck developer roles and recommends staffing actions.

---

## 📈 Step 4: Engineering Analytics & Codebase Hotspots

1. Click on **Analytics** in the sidebar.
2. Explore the tabs:
   - **Hotspots**: Displays fragile files in the selected project. High churn + low test coverage files will be flagged.
   - **Team Benchmarks**: Shows a radar breakdown of key metrics (on-time delivery, cycle time, review lag) and presents an **AI Optimization Plan**.
   - **Skill Heatmap**: A bar chart mapping technology stacks to historical sprint delays and risk levels, indicating technical bottlenecks.
   - **Sprint Trends**: Logs the model's risk score predictions over the course of the sprint, showing how team health improves or declines day-by-day.

---

## ⚙️ Step 5: Platform Settings

1. Click on **Settings** in the sidebar.
2. View user profile details, active roles, and GitHub OAuth integrations.
3. You can update your profile name and link your GitHub username to test custom user commits.
