# 1024 Game - Mini Program

A 1024 puzzle game (2048-style) for WeChat Mini Game platform.

## Features

- Classic 4x4 tile-sliding puzzle gameplay
- Swipe to move tiles, merge matching numbers
- Goal: reach 1024
- Persistent high score (local storage)
- Global leaderboard (WeChat Cloud Database)
- User identification via WeChat OpenID

## How to Deploy

### 1. Cloud Development Setup

1. Open project in WeChat Dev Tools
2. Click Cloud icon (☁) in toolbar
3. Enable cloud development, select environment: `cloud1-d6gimfu7tb84572e1`
4. Database: Create collection `scores`
5. Cloud Functions: Deploy `login` and `getRank`

### 2. Upload & Publish

1. Click Upload (☁) in Dev Tools toolbar
2. Fill version and description
3. Go to mp.weixin.qq.com → Version Management
4. Submit for review → Publish

## Version History

### v2.0.2 (Latest)
- Fixed: New Game button not visible
- Fixed: Leaderboard button position (was overlapping score boxes)
- Fixed: Overlay button tap detection coordinates
- Added: Leaderboard feature with cloud database

### v1.0.0
- Initial release
- Basic 1024 gameplay
- Touch swipe controls
- Local high score storage