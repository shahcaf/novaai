# Deploying Nova AI to Render (Backend)

To deploy your backend to Render, follow these steps:

1.  **Create a New Web Service:**
    *   Sign in to [Render](https://render.com/).
    *   Click **New** > **Web Service**.
    *   Connect your GitHub repository.
    *   Select the `novaai` repository.

2.  **Configure the Service:**
    *   **Name:** `nova-ai-backend` (or your preferred name).
    *   **Root Directory:** `server` (Important: this points to the backend folder).
    *   **Environment:** `Node`.
    *   **Build Command:** `npm install`.
    *   **Start Command:** `npm start`.

3.  **Set Environment Variables:**
    *   Go to the **Environment** tab.
    *   Add `GROQ_API_KEY`: Your actual Groq API key from [Groq Console](https://console.groq.com/keys).
    *   Add `PORT`: `5000` (Render will override this, but it's good practice).

4.  **Deploy:**
    *   Click **Create Web Service**.
    *   Wait for the build to finish. Once done, copy the service URL (e.g., `https://nova-ai-backend.onrender.com`).

# Deploying Nova AI to Vercel (Frontend)

1.  **Create a New Project:**
    *   Sign in to [Vercel](https://vercel.com/).
    *   Click **Add New** > **Project**.
    *   Select the `novaai` repository.

2.  **Configure the Project:**
    *   **Root Directory:** `client`.
    *   **Framework Preset:** `Vite`.

3.  **Set Environment Variables:**
    *   Add `VITE_API_URL`: The URL of your Render backend service (e.g., `https://nova-ai-backend.onrender.com`).

4.  **Deploy:**
    *   Click **Deploy**.
