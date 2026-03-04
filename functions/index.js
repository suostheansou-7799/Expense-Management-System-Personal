/**
 * Firebase Cloud Functions for Admin Management
 * Project: share-firebase-417ca
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// ============================================
// ADMIN EMAIL CONFIGURATION
// ============================================
// អ្នកដែលមានសិទ្ធិជា Admin (កែប្រែនៅទីនេះ)
const ADMIN_EMAILS = [
    "suostheansou@gmail.com", // ← Admin ដំបូង
    "theansou092@gmail.com",
];

// ============================================
// Function 1: Set Admin Role
// ============================================
// Admin អាចកំណត់ Admin ផ្សេងទៀត
exports.setAdminRole = functions.https.onCall(async(data, context) => {
    // Check if caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    // Check if caller is an admin
    const callerEmail = context.auth.token.email;
    const isCallerAdmin = context.auth.token.admin === true || ADMIN_EMAILS.includes(callerEmail);

    if (!isCallerAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Only admins can set admin roles.");
    }

    const targetEmail = data.email;
    if (!targetEmail) {
        throw new functions.https.HttpsError("invalid-argument", "Email is required.");
    }

    try {
        const user = await admin.auth().getUserByEmail(targetEmail);
        await admin.auth().setCustomUserClaims(user.uid, { admin: true });
        return { success: true, message: `${targetEmail} is now an admin!` };
    } catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// ============================================
// Function 2: Remove Admin Role
// ============================================
exports.removeAdminRole = functions.https.onCall(async(data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    const callerEmail = context.auth.token.email;
    const isCallerAdmin = context.auth.token.admin === true || ADMIN_EMAILS.includes(callerEmail);

    if (!isCallerAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Only admins can remove admin roles.");
    }

    const targetEmail = data.email;
    try {
        const user = await admin.auth().getUserByEmail(targetEmail);
        await admin.auth().setCustomUserClaims(user.uid, { admin: false });
        return { success: true, message: `${targetEmail} is no longer an admin.` };
    } catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// ============================================
// Function 3: Get All Users (Admin Only)
// ============================================
exports.getAllUsers = functions.https.onCall(async(data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    const callerEmail = context.auth.token.email;
    const isCallerAdmin = context.auth.token.admin === true || ADMIN_EMAILS.includes(callerEmail);

    if (!isCallerAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Only admins can view all users.");
    }

    try {
        const listUsersResult = await admin.auth().listUsers(100);
        const users = listUsersResult.users.map((user) => ({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || (user.email ? user.email.split("@")[0] : "No Name"),
            photoURL: user.photoURL,
            isAdmin: user.customClaims && user.customClaims.admin === true,
            createdAt: user.metadata.creationTime,
            lastSignIn: user.metadata.lastSignInTime,
        }));
        return { success: true, users };
    } catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});

// ============================================
// Function 4: Initialize First Admin
// ============================================
// ប្រើម្តងដំបូង ដើម្បីកំណត់ Admin ដំបូង
exports.initializeFirstAdmin = functions.https.onCall(async(data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    const callerEmail = context.auth.token.email;

    // Only allow emails in ADMIN_EMAILS list to become first admin
    if (!ADMIN_EMAILS.includes(callerEmail)) {
        throw new functions.https.HttpsError("permission-denied", "You are not authorized to be an admin.");
    }

    try {
        await admin.auth().setCustomUserClaims(context.auth.uid, { admin: true });
        return { success: true, message: `${callerEmail} is now the first admin!` };
    } catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});