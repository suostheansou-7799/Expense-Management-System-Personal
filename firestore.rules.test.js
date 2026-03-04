// Unit test cases for Firestore security rules (using Firebase Emulator Suite)
// Save as firestore.rules.test.js and run with Jest or similar framework

const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');

const rules = readFileSync('firestore.rules', 'utf8');

let testEnv;

beforeAll(async() => {
    testEnv = await initializeTestEnvironment({
        projectId: 'demo-test',
        firestore: { rules },
    });
});

afterAll(async() => {
    if (testEnv) {
        await testEnv.cleanup();
    }
});

describe('Firestore Security', () => {
    it('User cannot read others expenses', async() => {
        const alice = testEnv.authenticatedContext('alice');
        const bob = testEnv.authenticatedContext('bob');
        const aliceDb = alice.firestore();
        const bobDb = bob.firestore();
        await assertSucceeds(aliceDb.collection('expenses').doc('exp1').set({ userId: 'alice', amount: 10 }));
        await assertFails(bobDb.collection('expenses').doc('exp1').get());
    });

    it('User can only create expense for self', async() => {
        const alice = testEnv.authenticatedContext('alice');
        const aliceDb = alice.firestore();
        await assertSucceeds(aliceDb.collection('expenses').add({ userId: 'alice', amount: 5 }));
        await assertFails(aliceDb.collection('expenses').add({ userId: 'bob', amount: 5 }));
    });

    it('User cannot invalidate another user session', async() => {
        const alice = testEnv.authenticatedContext('alice');
        const bob = testEnv.authenticatedContext('bob');
        const aliceDb = alice.firestore();
        await assertFails(aliceDb.collection('session_invalidations').doc('bob').set({ reason: 'force' }));
    });

    it('Admin can read/write any expense', async() => {
        const admin = testEnv.authenticatedContext('admin', { admin: true });
        const adminDb = admin.firestore();
        await assertSucceeds(adminDb.collection('expenses').doc('exp1').get());
        await assertSucceeds(adminDb.collection('expenses').doc('exp1').set({ userId: 'alice', amount: 10 }));
    });

    it('User can read legacy expense by matching email', async() => {
        await testEnv.withSecurityRulesDisabled(async(context) => {
            const db = context.firestore();
            await db.collection('expenses').doc('legacy1').set({
                userId: 'old-alice-uid',
                userEmail: 'alice@example.com',
                amount: 30,
            });
        });

        const aliceNewUid = testEnv.authenticatedContext('alice-new-uid', { email: 'alice@example.com' });
        const aliceDb = aliceNewUid.firestore();
        await assertSucceeds(aliceDb.collection('expenses').doc('legacy1').get());
    });

    it('User cannot read legacy expense with different email', async() => {
        await testEnv.withSecurityRulesDisabled(async(context) => {
            const db = context.firestore();
            await db.collection('expenses').doc('legacy2').set({
                userId: 'old-alice-uid',
                userEmail: 'alice@example.com',
                amount: 45,
            });
        });

        const bob = testEnv.authenticatedContext('bob-new-uid', { email: 'bob@example.com' });
        const bobDb = bob.firestore();
        await assertFails(bobDb.collection('expenses').doc('legacy2').get());
    });
});