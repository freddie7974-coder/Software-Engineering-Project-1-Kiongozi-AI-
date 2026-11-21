# Kiongozi AI: Web Accessibility Chrome Extension

A Chrome extension that makes web content easier to read and understand. It simplifies text, translates it, and describes images, using a Flask backend powered by Google's Gemini 2.5 Flash API. "Kiongozi" is Swahili for "guide".

## Features
- **Text simplification:** rewrites complex page text in plain language
- **Translation:** translates selected content into Swahili, English or Kikuyu
- **Image description:** generates descriptions for images that lack alt text
- **Accessibility controls:** font size, contrast, spacing, etc.

## Design and Evaluation
- Designed around universal design principles
- Refined over several iterations based on feedback from the course instructor
- Evaluated with HCI methods: [e.g. heuristic evaluation, user testing]

## Architecture
- **Extension (frontend):** [JavaScript, HTML, CSS] running in Chrome
- **Backend:** Python and Flask, which calls the Gemini API
- The extension sends page content to the backend; the backend returns the simplified, translated, or described result

## Tech Stack
Python, Flask, Gemini 2.5 Flash API, [JavaScript], Chrome Extensions (Manifest [V3])

## Getting Started

### Backend
```bash
cd backend
pip install -r requirements.txt
export GEMINI_API_KEY="your-key-here"
flask run
```

### Extension
1. Open `chrome://extensions` in Chrome
2. Turn on **Developer mode**
3. Click **Load unpacked** and select the `extension` folder

## Screenshots
<img width="975" height="549" alt="image" src="https://github.com/user-attachments/assets/93d44d40-41a7-48ef-8cbf-3d31964e5643" />
<img width="975" height="549" alt="image" src="https://github.com/user-attachments/assets/3d0f7e69-841f-48d2-886f-4ce322a8d51c" />
<img width="975" height="548" alt="image" src="https://github.com/user-attachments/assets/1930b2e0-6720-4a62-a19d-918ea6d29bf5" />
<img width="908" height="510" alt="image" src="https://github.com/user-attachments/assets/082faac5-6de3-4f47-a255-d1390fd61795" />
<img width="975" height="548" alt="image" src="https://github.com/user-attachments/assets/55b273af-86c0-4ce2-b2be-ae661a48b02f" />






## Future Improvements
- [Support more languages]
- [Offline or cached results]
- [User preference profiles]

## Author
Fredrick: [github.com/freddie7974-coder](https://github.com/freddie7974-coder)
