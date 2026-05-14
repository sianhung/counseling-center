# Counseling Center — AI Chatbot 🇲🇲 🇬🇧

A warm, empathetic, bilingual (Myanmar / Burmese & English) AI counseling assistant web application powered by **Google Gemini AI**.

Designed specifically to provide a confidential, comforting space for emotional support, stress management, and mindfulness techniques.

## Features

- **🇲🇲 & 🇬🇧 Bilingual Fluent Support**: Mirrors user language automatically. Chat in Burmese script or English, and the AI responds in the exact same language.
- **Client-Side Only (No Backend)**: Pure HTML, CSS, and Vanilla JS. Securely stores API keys locally in the browser (`localStorage`).
- **Google Gemini 2.0 Flash Powered**: Fast, intelligent, and highly empathetic streaming responses.
- **Premium UI & Glassmorphism Aesthetics**: Therapeutic calming gradients, smooth animations, typing indicators, and full dark/light mode toggle.
- **Instant Deployment**: Fully compatible with **GitHub Pages** for free, one-click hosting.

---

## Quick Setup & Deployment to GitHub Pages

Since this application runs entirely in the browser, deploying it to GitHub Pages takes less than 2 minutes.

### 1. Upload to GitHub
1. Create a new repository on your GitHub account (e.g. `counseling-center`).
2. Upload all the files from this folder (`index.html`, `style.css`, `app.js`, `assets/logo.svg`).
3. Commit and push your changes to the `main` branch.

### 2. Enable GitHub Pages
1. In your GitHub repository, navigate to **Settings**.
2. On the left sidebar, click on **Pages**.
3. Under **Build and deployment** → **Source**, select **Deploy from a branch**.
4. Under **Branch**, select `main` (or `master`) and `/ (root)` folder.
5. Click **Save**.
6. Within a minute or two, your live HTTPS link will be available at `https://<your-username>.github.io/counseling-center`.

---

## Configuring the Gemini API Key

1. Go to [Google AI Studio](https://ai.google.dev/) and log in with your Google account.
2. Click on **Get API Key** and create a new free API key.
3. Open your live Counseling Center web app.
4. Click on the **Setup API Key** button at the top right.
5. Paste your API key and click **Save**. You are ready to chat!

---

## Technical Details & Security

- **Where is the API Key stored?**  
  The API key is stored in your browser's `localStorage`. It is **never** transmitted to any third-party server, backend, or tracking service. It only communicates directly with Google's `generativelanguage.googleapis.com` secure API endpoints.
- **Bilingual System Prompt**  
  The system instruction directs Gemini to detect user sentiment, mirror language tone, and provide structured, supportive mental health guidance without replacing licensed professional medical advice.
