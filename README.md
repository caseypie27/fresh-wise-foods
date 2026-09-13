# FreshTrack 

Build a Complete Mobile App: FreshTrack

Create a fully functional, modern mobile application called FreshTrack for Android and iOS.

App Purpose

FreshTrack helps users track food expiry dates, receive reminders before food expires, reduce food waste, and discover recipes that use ingredients that are close to expiring.

The app should have a clean, modern, minimalistic design with smooth animations, rounded corners, and an intuitive user experience.

Color palette:

- Primary: Fresh Green

- Secondary: White

- Accent: Light Beige

- Optional Dark Mode

---

Splash Screen

Display:

FreshTrack

Tagline:

"Stay Fresh. Waste Less. Save More."

Background:

- Minimalistic grocery and food illustrations.

- Modern and elegant appearance.

- Smooth fade-in animation.

Automatically navigate to the onboarding screens after a few seconds.

---

Onboarding Flow

Screen 1

Title:

Track Food Expiry Dates Easily

Description:

Take a photo of food packaging and let FreshTrack automatically detect expiry dates using OCR technology.

Illustration:

Camera scanning food packaging.

---

Screen 2

Title:

Never Miss an Expiry Date

Description:

Receive timely notifications before food expires.

Illustration:

Notification reminder.

---

Screen 3

Title:

Turn Ingredients Into Meals

Description:

Get recipe suggestions based on foods that are close to expiring.

Illustration:

Recipe cards and food items.

---

Final Onboarding Screen

Request notification permission.

Title:

Stay Updated

Description:

Enable notifications to receive expiry reminders and recipe suggestions.

Buttons:

- Allow Notifications

- Not Now

---

Authentication

Allow:

- Sign Up

- Sign In

- Continue with Google

- Continue with Apple (iOS)

- Forgot Password

Store user accounts securely.

---

Home Dashboard

Display:

Greeting:

"Good Morning, [User Name]"

Summary Cards:

- Total Food Items

- Expiring This Week

- Expiring Today

- Expired Items

- Food Waste Prevented

Quick Actions:

- Add Item

- Scan Food

- View Recipes

Section:

Items Expiring Soon

Display food cards sorted by nearest expiry date.

---

Add Food Item

Floating Action Button:

+ Add Item

When pressed:

Options:

1. Take Photo

2. Upload Image

3. Add Manually

---

OCR Scanning Feature

When user takes or uploads a photo:

Use OCR to detect:

- Product Name

- Expiry Date

- Manufacturing Date (if available)

Show results before saving.

Example:

Product Name:

Banana

Expiry Date:

20 June 2026

Buttons:

- Save

- Edit Information

- Rescan

User must be able to manually correct OCR mistakes.

---

Food Inventory Screen

Display all foods in a clean card list.

Each card contains:

Food Image

Food Name

Expiry Date

Days Remaining

Status Indicator

Examples:

Green:

Fresh

Orange:

Expiring Soon

Red:

Expired

Gray:

Consumed

Actions:

- Edit

- Delete

- Mark as Consumed

Allow searching and filtering.

Filters:

- Fresh

- Expiring Soon

- Expired

- Consumed

---

Smart Recipe Recommendation System

Automatically analyze foods that are near expiry.

Example:

Banana expires in 2 days.

Recommend:

- Banana Bread

- Banana Cake

- Banana Pancakes

- Banana Smoothie

Recipe cards should contain:

- Recipe Image

- Cooking Time

- Difficulty Level

- Ingredients

- Instructions

The recommendation system should work for any food item.

If multiple foods are close to expiring, generate recipes that use multiple ingredients together.

Example:

Banana + Milk

Suggested Recipe:

Banana Milkshake

---

Smart Notifications

Send push notifications.

Examples:

"Your bananas expire in 2 days. Try making Banana Bread."

"Milk expires tomorrow."

"You have 5 food items expiring this week."

Notification settings:

- 7 days before expiry

- 3 days before expiry

- 1 day before expiry

- Expiry day

User can customize reminder frequency.

---

Calendar View

Provide a calendar showing upcoming expiry dates.

Features:

- Monthly View

- Weekly View

- Expiry Highlights

- Tap a date to see food items expiring on that day

---

Analytics Dashboard

Show statistics:

- Total Items Tracked

- Food Consumed Before Expiry

- Expired Food Count

- Estimated Food Waste Reduction

Use charts and graphs.

---

Profile & Settings

Include:

- Profile Information

- Notification Settings

- Dark Mode

- Language Selection

- Privacy Settings

- Data Backup

- Account Management

---

Database Requirements

Store:

- User Accounts

- Food Items

- Food Images

- Expiry Dates

- Consumption Status

- Notification Preferences

Data should persist after app restart.

---

AI Features

1. OCR for expiry date detection.

2. AI recipe recommendation system.

3. Smart ingredient matching.

4. Personalized suggestions based on user inventory.

---

Technical Requirements

- Responsive mobile design.

- Android and iOS support.

- Smooth animations.

- Fast loading performance.

- Secure authentication.

- Push notification support.

- Scalable database structure.

- Production-ready UI.

---

Design Requirements

Style:

Modern, premium, minimalistic.

Inspiration:

Apple Health, Notion, Duolingo, and modern grocery apps.

Prioritize:

- Simplicity

- Accessibility

- Readability

- Clean spacing

- Beautiful typography

The final result should feel like a polished, professional app available on the App Store and Google Play Store.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://freshtrackmobile.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/956ae285-71ba-4e60-ac4f-8c5ef5cd0ab4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
