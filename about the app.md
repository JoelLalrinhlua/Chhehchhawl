# Chhehchhawl – User Workflow Documentation

## 1. App Overview (User Perspective)

Chhehchhawl is a peer-to-peer task marketplace where users can either **post tasks** (request help) or **accept tasks** (earn money). The app is designed to be smooth, intuitive, and responsive, with dark mode enabled by default. Every interaction is optimized for clarity, minimal friction, and fluid animations.

From the user’s point of view, the app has three primary sections:
- **Home** – Browse and discover available tasks.
- **My Tasks** – Manage posted and accepted tasks.
- **Profile** – Manage account settings and logout.

---

# 2. User Journey Flow

## Step 1: Launching the App

When the user opens the app:
- The app opens in **Dark Mode** (default).
- Smooth splash-to-login transition animation.
- Clean and minimal interface consistent with the design reference.

---

## Step 2: Login Page

### What the User Sees:
- Email input field
- Password input field
- Login button
- Create Account option

### Interaction Flow:
- Input fields animate subtly on focus.
- Button provides press feedback (scale/ripple).
- On login (currently bypassed if backend not connected):
  - Smooth transition animation (fade + slide) into the Home page.
  - No abrupt screen changes.

---

# 3. Main App Layout

After login, the user enters the main interface.

## Bottom Navigation Bar

The bottom navigation contains:

1. **Home**
2. **My Tasks**
3. **Profile**

Navigation between tabs is smooth with animated transitions (no hard screen reloads).

---

# 4. Home Page (Task Marketplace)

## Purpose
The Home page acts as the central task discovery feed.

## Top App Bar
- App Logo or Title (left side)
- “Create Task” button (top-right corner)

## Task Feed

The main content area displays a scrollable list of task cards.

### Each Task Card Displays:
- Task Title
- Short Description
- Reward Amount (₹)
- Status (Open / Assigned / Completed)
- Posted Time

### Interactions:
- Smooth scrolling with natural momentum.
- Tapping a task card triggers:
  - A smooth pop-up modal or bottom sheet animation.
  - Expanded task details.
  - Apply button.

---

## Applying for a Task

When a user taps **Apply**:
- Application is submitted.
- Visual confirmation appears.
- Task remains visible until assigned.

---

# 5. Create Task Page

Accessed via the **Create Task** button on the Home page.

## What the User Sees:
- Task Title input
- Description input
- Reward amount input
- Optional location field
- Submit button

## Interaction Flow:
- Inputs animate on focus.
- Submit button shows loading animation.
- On successful submission:
  - Smooth navigation back to Home.
  - Newly created task animates into the feed (appears at top).

---

# 6. My Tasks Section

Contains two animated tabs:

## Tab 1: My Posts
Displays tasks created by the user.

Each task shows:
- Current status
- Applicants (if any)
- Accept/Reject options

### When Poster Accepts a Tasker:
- Task status changes to “Assigned”.
- Private chat is created automatically.

---

## Tab 2: My Tasks
Displays tasks the user has:
- Applied for
- Been assigned to

Each task shows:
- Task details
- Current status
- Chat access (if assigned)
- Finish Task button (if user is tasker)

---

# 7. Chat System

Once assigned:

- Private chat opens between Poster and Tasker.
- Real-time messaging.
- Typing indicator.
- Seen status.
- Location sharing (optional).

Smooth message animations and auto-scroll behavior.

---

# 8. Task Completion Workflow

## Step 1: Tasker clicks “Finish Task”
- Status changes to: **Pending Confirmation**
- Poster receives update.

## Step 2: Poster confirms completion
- Status changes to: **Completed**
- Task closes permanently.
- Transaction is recorded.

Invalid transitions are not allowed.

---

# 9. Profile Page

Accessible from bottom navigation.

## Displays:
- User information
- Dark Mode toggle
- Logout button

### Dark Mode Toggle:
- Instantly switches between dark/light themes.
- Smooth theme transition animation.

### Logout:
- Clears session.
- Smooth transition back to Login page.

---

# 10. Task Lifecycle (Simplified)

Open → Assigned → Pending Confirmation → Completed

Each state change is intentional and system-controlled to prevent errors.

---

# 11. Overall Experience Goals

- Fluid animations across screens.
- No abrupt transitions.
- Clear task states.
- Clean navigation.
- Minimal clutter.
- Professional, marketplace-style UX.
- Responsive and scalable structure.

---

# Summary

From a user’s perspective, Chhehchhawl is:

- A smooth, modern task marketplace.
- Simple to post and accept tasks.
- Clear in workflow.
- Structured with defined task states.
- Designed with strong visual hierarchy and micro-interactions.

The entire experience prioritizes clarity, efficiency, and seamless interaction.