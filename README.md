# Sprite Maker

Generate game sprites from photos using OpenAI's image generation API.

## Features

- Upload a full-body photo
- Generate sprites in 3 different styles:
  - 8-bit Retro (Mario Bros style)
  - Arcade Fighter (Street Fighter style)
  - Modern Cartoon (Mobile game style)
- Generate different actions for your character:
  - Idle stance
  - Walking animation
  - Jumping poses
  - Punching moves
  - Kicking moves

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open your browser to the URL shown in the terminal (usually http://localhost:8080)

4. Enter your OpenAI API key (get one from https://platform.openai.com/api-keys)

## Usage

1. Select your preferred model (DALL·E 2 or GPT-Image 1)
2. Enter your OpenAI API key
3. Upload a full-body photo
4. Click "Generate 3 Sprite Styles"
5. Select your preferred style
6. Choose an action to generate

## Notes

- The API key is stored in your browser's localStorage
- Images are processed directly in your browser
- No data is stored on any server
- GPT-Image 1 requires organization verification from OpenAI 