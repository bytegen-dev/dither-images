# Image Dithering App

A minimalist web app that converts images into black-and-white dotted patterns using dithering algorithms.

## Features

- **Image Upload**: Drag-and-drop or file picker for JPG/PNG files
- **Square Crop**: Automatic cropping to square format for optimal dithering
- **Grid Control**: Adjustable complexity from 16×16 to 400×400 dots
- **Real-time Preview**: Instant dithering with live updates
- **Export Options**: Download as PNG or SVG, copy to clipboard
- **Retry Button**: Regenerate dithering with current settings

## Tech Stack

- Next.js 15
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Lucide React icons
- react-easy-crop for image cropping
- html2canvas for PNG export

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Usage

1. Upload an image (drag & drop or click to browse)
2. Crop to square in the dialog
3. Adjust grid complexity with the slider
4. Export as PNG/SVG or copy to clipboard

## License

MIT
