# JFT-Basic Simulation Hub

An interactive web portal and simulation platform for taking **Japan Foundation Test for Basic Japanese (JFT-Basic)** practice exams.

## Features

- **Extensive Practice Set**: Central hub with access to 400+ simulated JFT-Basic exam sets.
- **Realistic Exam Interface**: Timed mock exam simulator closely mirroring the official computer-based testing (CBT) experience.
- **Section Coverage**:
  - Script & Vocabulary (文字・語彙)
  - Conversation & Expression (会話・表現)
  - Listening Comprehension (聴解)
  - Reading Comprehension (読解)
- **Exam History & Analytics**: Local storage-based score tracking, pass/fail status, and detailed answer review.
- **PWA Ready**: Offline support and installable progressive web app.

## Project Structure

```text
├── index.html           # Main portal & exam selection hub
├── exam.html            # Interactive CBT exam test-taking interface
├── history.html         # Past exam attempt history & performance reviews
├── css/                 # Design system, themes, and layout styles
├── js/                  # Exam engine, audio players, timers, and storage
├── exams/               # Exam question datasets (JSON), images, and audio assets
├── netlify/             # Serverless deployment configuration
└── netlify.toml         # Netlify routing and build rules
```

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/boktiarshakil/JFT-Basic.git
   ```
2. Open `index.html` in any modern web browser or serve it locally:
   ```bash
   npx serve .
   # or
   python -m http.server 8080
   ```

## License

MIT License
