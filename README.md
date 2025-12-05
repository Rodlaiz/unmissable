# Unmissable Mobile App

A React Native (Expo) app that helps users track their favorite artists and get notified about upcoming concerts and shows.

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npx expo start
```

### Running on Devices

- **iOS Simulator**: Press `i` in the terminal
- **Android Emulator**: Press `a` in the terminal  
- **Physical Device**: Scan the QR code with Expo Go app

## Project Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Home/Feed
│   │   ├── search.tsx     # Search artists/events
│   │   ├── artists.tsx    # My Artists
│   │   └── settings.tsx   # Settings
│   ├── onboarding/        # Onboarding flow
│   ├── event/[id].tsx     # Event details
│   ├── artist/[id].tsx    # Artist details
│   └── _layout.tsx        # Root layout
├── components/            # Reusable components
│   ├── Button.tsx
│   ├── Input.tsx
│   └── Card.tsx
├── context/               # React Context providers
│   └── UserContext.tsx
├── services/              # API services
│   ├── ticketmaster.ts    # Ticketmaster API
│   ├── location.ts        # Geocoding
│   ├── resale.ts          # SeatGeek resale
│   ├── wikipedia.ts       # Artist bios
│   ├── theaudiodb.ts      # Artist images
│   ├── storage.ts         # AsyncStorage wrapper
│   └── notifications.ts   # Push notifications
├── types.ts               # TypeScript types
└── assets/                # Images and fonts
```

## Features

- **Onboarding Flow**: Set location, select categories, add favorite artists
- **Home Feed**: See upcoming events based on preferences
- **Search**: Find artists and events
- **Artist Tracking**: Follow artists to get notified
- **Event Details**: View event info, find resale tickets
- **Push Notifications**: Get alerts for new events

## Tech Stack

- **React Native** with **Expo** (managed workflow)
- **TypeScript** for type safety
- **Expo Router** for file-based navigation
- **NativeWind** (Tailwind CSS for React Native)
- **AsyncStorage** for local persistence

## API Integrations

- **Ticketmaster Discovery API**: Events and attractions
- **SeatGeek API**: Resale ticket listings  
- **Open-Meteo Geocoding**: City search
- **Wikipedia API**: Artist biographies
- **iTunes Search API**: Artist discography

## Environment Variables

Create a `.env` file (or set in app.json extra):

```
TICKETMASTER_API_KEY=your_key_here
SEATGEEK_CLIENT_ID=your_client_id
```

## Scripts

```bash
npm start       # Start Expo dev server
npm run ios     # Run on iOS simulator
npm run android # Run on Android emulator
npm run lint    # Run ESLint
```

## License

MIT
