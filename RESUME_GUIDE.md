# ⏯️ Resume Guide — AI-Powered Software Delivery Risk Intelligence Platform

This guide documents the current setup status and explains how to resume executing the project. 

---

## 📊 Project Status & Progress (Where We Stopped)

1. **Venv & Python ML Service Dependencies**:
   * We created the Python virtual environment (`venv`) inside `ml-service/`.
   * **Packages status**: **100% complete** and all dependencies are fully set up in the virtual environment!
2. **Environment Variables**:
   * We successfully updated the root `.env` file with the **Groq API Key** you provided.

---

## 🛠️ How to Resume When You Start Antigravity Again

### Step 1: Install the Databases (MongoDB & PostgreSQL) Natively on Windows
Before restarting the servers, install both database engines natively (which consumes less than 150MB of RAM combined):

#### **1. MongoDB Setup**
* Go to your `Downloads` folder (`C:\Users\steve\Downloads`).
* Double-click **`mongodb-windows-x86_64-8.3.2-signed.msi`** to start setup.
* Choose **Complete** installation.
* ⚠️ **Ensure "Install MongoDB as a Service" is checked** on the Service Configuration screen.
* Click Install.
* Install **`mongosh-2.8.3-x64.msi`** from the same Downloads folder.

#### **2. PostgreSQL Setup**
* Go to the [Official PostgreSQL Downloads Page](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads) and download the installer for **PostgreSQL 15** or **16** for Windows.
* Run the installer:
  * Port: **`5432`**
  * Password: Set the password for the database superuser to **`drp_secret_2024`** (this matches the project `.env` file).

---

### Step 2: Inform the AI
Once you restart Antigravity, simply tell the AI:
> *"I have installed MongoDB and PostgreSQL natively. Please read RESUME_GUIDE.md, verify that the services are active, seed the database, and execute the servers."*

---

## 🚀 Commands the AI will Run to Start the Platform

For reference, these are the exact commands the AI will use to run your platform locally:

1. **Seed the database (MongoDB & Postgres)**:
   In the `backend` directory:
   ```bash
   npm run seed
   ```
2. **Launch the Node.js Backend API (Port 5000)**:
   In the `backend` directory:
   ```bash
   npm run dev
   ```
3. **Launch the Python FastAPI ML Service (Port 8000)**:
   In the `ml-service` directory (with `venv` activated):
   ```powershell
   .\venv\Scripts\activate
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
4. **Launch the React Frontend Dashboard (Port 3000)**:
   In the `frontend` directory:
   ```bash
   npm run dev
   ```
