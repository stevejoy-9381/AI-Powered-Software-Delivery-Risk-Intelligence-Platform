# Demo Script — DeliveryRisk AI Platform

This script guides you through a complete end-to-end demonstration of the DeliveryRisk AI platform, highlighting the machine learning and analytics features.

⏱️ **This demo takes 4–5 minutes**

---

## 🚪 Step 1: Authentication & Onboarding
1. Open http://localhost:3000 in your browser.
2. You will be greeted by a premium dark login portal.
3. Use the pre-seeded credentials:
   - **Email:** `admin@demo.com`
   - **Password:** `Demo@123`
4. Click **Sign In**.

---

## 📊 Step 2: The Command Center (Dashboard)
1. You are logged into the main **Dashboard** of TechCorp.
2. Note the real-time summary stat cards showing active sprints, at-risk sprints, and organization average health.
3. Hover over the **Risk Distribution** donut chart segments to see active counts.
4. Review the **Sprint Risk Overview** table showing active sprints sorted by highest delay risk.

---

## 📅 Step 3: Navigating to a Critical Sprint
1. Find a sprint in the table with a high risk score (e.g., `Sprint 10` on `Platform Core` or similar).
2. Click the row to open the **Sprint Detail View**.
3. Point out the **Risk Gauge** displaying the delay probability score and the specific **Risk Factors** listed below it.

---

## 📋 Step 4: Interactive "What Needs to Improve" Checklist
1. Click on the parent **Project** link in the header to go to the Project page.
2. Scroll to the **What Needs to Improve** checklist section.
3. Toggle checkable items representing critical action checklist points (e.g. "Add test cases to hotspots", "Schedule review pairing") to demonstrate active team remediation tracking.

---

## 🔄 Step 5: Batch Analyzing Pull Requests
1. Navigate back to the **Sprint Detail View**.
2. Scroll down to the **Pull Requests** table card.
3. Click the **"Batch Analyze PRs"** button in the top-right of the PR card header.
4. Watch the status spinner as the Node backend invokes the FastAPI batch summarization endpoints.

---

## 🏷️ Step 6: PR Risk & Security Flags Callout
1. Once batch analysis is done, click on any individual PR row in the table (e.g., one touching authentication logic).
2. The **AI Side Panel** will slide out from the right.
3. Call out the **LLM Summary** and the specific **Security & Risk Flags** (e.g., "Touches auth logic", "No tests included").

---

## 🕵️ Step 7: Cross-PR Risk Pattern Detections
1. Close the side panel and look right above the PR Table.
2. A new card titled **"Detected PR Risk Patterns"** has appeared.
3. Explain how the FastAPI NLP service identified cross-PR risks (e.g., "Multiple PRs modifying payment gateways without tests concurrently") to help prevent build failures.

---

## 🌲 Step 8: Codebase Hotspots & Treemap Navigation
1. Click on **Analytics** in the sidebar and select the **Hotspots** tab.
2. Click the **"Only Flagged"** toggle to filter the files.
3. Hover over the tree-nested rectangles on the **Recharts Treemap** to display churn rate, coverage, and hotspot complexity scores.

---

## 🎯 Step 9: Dual-Team Benchmarking Comparison
1. Switch to the **Team Benchmarks** tab inside Analytics.
2. Toggle the **Masked Names** switch to demonstrate compliance/anonymization capability.
3. Select a secondary comparison team from the dropdown to render a **Dual Radar Chart** comparing velocity, PR health, code quality, process health, and team capacity.

---

## 🏁 Step 10: Release Readiness Predictor & Wrap-Up
1. Select the **Release Readiness** tab.
2. Show the composite score (e.g., a release score of **45%** when critical PRs are open or active sprint risk is high).
3. Walk through the listed **Blockers** (e.g. "5 codebase hotspots flagged", "Only 2 days remaining") and the **AI Recommendations**.
4. Log out of the platform to conclude the demonstration.
