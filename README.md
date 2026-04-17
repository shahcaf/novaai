# ChatGPT Clone

A full-stack ChatGPT-like application built with React (Vite) and Node.js (Express), powered by OpenAI's GPT-4o-mini.

## Features
- **Modern UI**: Clean, minimalist design inspired by ChatGPT.
- **Dark Mode**: High-contrast dark theme for better readability.
- **AI Chat**: Real-time conversation with history management.
- **Responsive**: Works perfectly on mobile and desktop.
- **Animations**: Smooth fade-ins and loading states.

## Prerequisites
- Node.js installed on your machine.
- An OpenAI API Key.

## Setup Instructions

### 1. Backend Setup
1. Open a terminal and navigate to the `server` directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `server` directory (or copy `.env.example`):
   ```bash
   cp .env.example .env
   ```
4. Open `.env` and add your OpenAI API Key:
   ```
   OPENAI_API_KEY=your_actual_key_here
   ```
5. Start the server:
   ```bash
   npm start
   ```
   The backend will run on `http://localhost:5000`.

### 2. Frontend Setup
1. Open a new terminal and navigate to the `client` directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to the URL provided (typically `http://localhost:5173`).

## Project Structure
- `/client`: React application (Vite)
- `/server`: Node.js Express server
