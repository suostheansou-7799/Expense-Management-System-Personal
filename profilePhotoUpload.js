// profilePhotoUpload.js
// Handles profile photo upload, compression, progress, error/retry, and Firebase integration
// Usage: import { initProfilePhotoUpload } from './profilePhotoUpload.js';

import compressImage from './imageCompression.js';

/**
 * Initialize the profile photo upload component
 * @param {Object} opts
 * @param {string} opts.uid - Firebase Auth user ID
 * @param {function} opts.getToken - Returns Firebase Auth token
 * @param {function} opts.onProgress - Progress callback (0-100)
 * @param {function} opts.onSuccess - Success callback (photoURL)
 * @param {function} opts.onError - Error callback (message)
 * @param {function} opts.onCompressing - Called when compressing
 * @param {function} opts.onUploading - Called when uploading
 * @param {function} opts.onReset - Called when removing photo
 */
export function initProfilePhotoUpload({
    uid,
    getToken,
    onProgress,
    onSuccess,
    onError,
    onCompressing,
    onUploading,
    onReset
}) {
    const dropZone = document.getElementById('photo-drop-zone');
    const fileInput = document.getElementById('photo-file-input');
    const preview = document.getElementById('photo-preview');
    const removeBtn = document.getElementById('photo-remove-btn');
    const progressBar = document.getElementById('photo-progress-bar');
    const spinner = document.getElementById('photo-spinner');
    let lastFile = null;
    let retryCount = 0;

    // Drag & drop events
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
    fileInput.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    });
    removeBtn.addEventListener('click', () => {
        preview.src = '';
        preview.alt = 'No photo';
        progressBar.style.width = '0%';
        spinner.style.display = 'none';
        fileInput.value = '';
        if (onReset) onReset();
    });

    async function handleFile(file) {
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            onError('Only JPG, PNG, or WEBP images allowed.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            onError('Image must be under 5MB.');
            return;
        }
        lastFile = file;
        try {
            if (onCompressing) onCompressing();
            spinner.style.display = '';
            // Compress
            const compressed = await compressImage(file);
            // Preview
            preview.src = URL.createObjectURL(compressed);
            preview.alt = 'Preview';
            // Upload
            if (onUploading) onUploading();
            await uploadToFirebase(compressed);
        } catch (err) {
            onError('Compression or upload failed: ' + err.message);
            spinner.style.display = 'none';
        }
    }

    async function uploadToFirebase(blob) {
        // Firebase compat SDK assumed loaded
        const storage = firebase.storage();
        const storageRef = storage.ref();
        const ext = blob.type === 'image/png' ? 'png' : (blob.type === 'image/webp' ? 'webp' : 'jpg');
        const path = `profile_pictures/${uid}/${Date.now()}.${ext}`;
        const fileRef = storageRef.child(path);
        const uploadTask = fileRef.put(blob);
        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
                snap => {
                    const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                    progressBar.style.width = pct + '%';
                    if (onProgress) onProgress(pct);
                },
                err => {
                    if (retryCount < 2) {
                        retryCount++;
                        uploadToFirebase(blob).then(resolve).catch(reject);
                    } else {
                        onError('Upload failed: ' + err.message);
                        spinner.style.display = 'none';
                        reject(err);
                    }
                },
                async() => {
                    // Success
                    const url = await uploadTask.snapshot.ref.getDownloadURL();
                    // Update Auth
                    if (firebase.auth().currentUser) {
                        await firebase.auth().currentUser.updateProfile({ photoURL: url });
                    }
                    // Update Firestore
                    if (firebase.firestore) {
                        await firebase.firestore().collection('users').doc(uid).set({ photoURL: url }, { merge: true });
                    }
                    spinner.style.display = 'none';
                    progressBar.style.width = '100%';
                    if (onSuccess) onSuccess(url);
                    resolve(url);
                }
            );
        });
    }
}