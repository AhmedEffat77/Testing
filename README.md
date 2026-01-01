# WH Management (Firebase + GitHub Pages)

This is a static web app (HTML/CSS/JS) hosted on GitHub Pages and backed by:
- Firebase Authentication
- Cloud Firestore

## Roles
- `admin`
- `warehouse`
- `technical`
- `user`

A user must have:
- `approved: true`
- `active: true`
- `role` in the allowed roles

## Firestore Collections (Schema)

### `users` (doc id = Auth UID)
```json
{
  "name": "Ahmed Effat",
  "email": "ahmed@example.com",
  "department": "Warehouse",
  "role": "admin",
  "approved": true,
  "active": true,
  "createdAt": "<serverTimestamp>"
}
```

### `stockItems` (doc id = Reference or Model)
Required fields used by the app:
- `reference` (string) OR `model` (string)
- `category` (string)
- `availableQty` (number)
- `lowThreshold` (number)

### `requests` (auto id)
- `userId`, `requesterName`, `department`
- `itemReference`, `itemModel`, `qty`, `notes`
- `status`: `Pending`, `Approved`, `Rejected`, `Fulfilled`
- `managerComment`, `createdAt`, `updatedAt`, `updatedBy`

### `stockMovements` (auto id)
- `stockId`, `requestId`, `delta`, `before`, `after`, `actorId`, `createdAt`

## Firestore Security Rules
Paste into Firestore → Rules:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function userDoc() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data; }
    function isActiveApproved() {
      return signedIn() && userDoc().active == true && userDoc().approved == true;
    }
    function hasRole(role) {
      return isActiveApproved() && userDoc().role == role;
    }

    match /users/{uid} {
      allow create: if signedIn() && request.auth.uid == uid;
      allow read: if isActiveApproved() && (uid == request.auth.uid || hasRole("admin"));
      allow update: if (signedIn() && uid == request.auth.uid) || hasRole("admin");
      allow delete: if hasRole("admin");
    }

    match /requests/{id} {
      allow create: if isActiveApproved()
                    && request.resource.data.userId == request.auth.uid
                    && request.resource.data.status == "Pending";
      allow read: if isActiveApproved()
                  && (request.auth.uid == resource.data.userId || hasRole("warehouse") || hasRole("technical") || hasRole("admin"));
      allow update: if hasRole("warehouse") || hasRole("admin");
      allow delete: if hasRole("admin");
    }

    match /stockItems/{id} {
      allow read: if isActiveApproved();
      allow write: if hasRole("warehouse") || hasRole("admin");
    }

    match /stockMovements/{id} {
      allow read: if hasRole("warehouse") || hasRole("technical") || hasRole("admin");
      allow create: if hasRole("warehouse") || hasRole("admin");
      allow update, delete: if hasRole("admin");
    }
  }
}
```

## Firebase Console Checklist
1) Authentication → Sign-in method → enable **Email/Password**
2) Authentication → Settings → Authorized domains:
   - `ahmedeffat77.github.io`
3) Firestore Database → Create database → Production mode

## Deploy to GitHub Pages
Upload all files to your repository root, then:
Settings → Pages → Deploy from a branch → main → /root

## Notes
- Email notifications are not included in this static build. For production, add Firebase Extensions (Trigger Email) or Cloud Functions.
