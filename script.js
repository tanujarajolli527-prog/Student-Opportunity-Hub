import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, onSnapshot, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// PASTE YOUR REAL FIREBASE KEYS HERE
const firebaseConfig = {
  apiKey: "AIzaSyDIFWPCmUFzhvHtzMvs3Lh_g2YKI4qvXyg",
  authDomain: "student-opportunity-club.firebaseapp.com",
  projectId: "student-opportunity-club",
  storageBucket: "student-opportunity-club.firebasestorage.app",
  messagingSenderId: "658260620948",
  appId: "1:658260620948:web:312fa564dcb1a94738e681"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const submitAuth = document.getElementById('submitAuth');
const logoutBtn = document.getElementById('logoutBtn');
const statsBar = document.getElementById('stats-bar');

// Page Routing Elements
const mainContent = document.getElementById('main-content');
const dashSection = document.getElementById('dashboard-section');
const dashBtn = document.getElementById('dashBtn');
const navSwitches = document.querySelectorAll('.nav-switch');

let currentUser = null;

// Handle Login & Registration
submitAuth.onclick = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorText = document.getElementById('authError');
    
    submitAuth.innerText = "Processing...";
    errorText.innerText = "";

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            try {
                await createUserWithEmailAndPassword(auth, email, password);
                const statsRef = doc(db, 'platform', 'stats');
                const docSnap = await getDoc(statsRef);
                let count = docSnap.exists() ? docSnap.data().totalUsers + 1 : 1;
                await setDoc(statsRef, { totalUsers: count });
            } catch (signupError) {
                errorText.innerText = signupError.message;
                submitAuth.innerText = "Secure Login / Sign Up";
            }
        } else {
            errorText.innerText = error.message;
            submitAuth.innerText = "Secure Login / Sign Up";
        }
    }
};

// Handle Logout
logoutBtn.onclick = (e) => {
    e.preventDefault();
    signOut(auth);
};

// GATEKEEPER LOGIC
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        loginScreen.style.display = 'none';
        mainApp.style.display = 'block';
        submitAuth.innerText = "Secure Login / Sign Up";
        document.getElementById('dashboard-greeting').innerText = `Welcome, ${user.email.split('@')[0]}!`;
    } else {
        currentUser = null;
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
    }
});

// ==========================================
// SINGLE PAGE ROUTING (SWITCHING PAGES)
// ==========================================
dashBtn.onclick = (e) => {
    e.preventDefault();
    mainContent.style.display = 'none';
    dashSection.style.display = 'block';
    loadDashboardData(currentUser.uid); // Fetch cards when dashboard opens
};

// When clicking Home, Scholarships, Internships, etc., go back to main site
navSwitches.forEach(link => {
    link.onclick = () => {
        dashSection.style.display = 'none';
        mainContent.style.display = 'block';
    };
});
document.getElementById('nav-logo').onclick = () => {
    dashSection.style.display = 'none';
    mainContent.style.display = 'block';
};

// ==========================================
// SAVE FULL CARD DATA TO DATABASE
// ==========================================
document.querySelectorAll('.btn-save').forEach(btn => {
    btn.onclick = async (e) => {
        if (!currentUser) return;
        
        // Grab the specific card that was clicked
        const card = e.target.closest('.opportunity-card');
        
        // Extract all the data from the HTML
        const title = e.target.getAttribute('data-title');
        const badge = card.querySelector('.card-badge').innerText;
        const desc = card.querySelector('.desc').innerText;
        const link = card.querySelector('a').href;
        
        e.target.innerText = "Saving...";
        
        // Save everything to Firestore
        await addDoc(collection(db, 'saved_opportunities'), {
            uid: currentUser.uid,
            title: title,
            badge: badge,
            desc: desc,
            link: link,
            savedAt: new Date()
        });
        
        e.target.innerText = "✓ Saved";
        e.target.style.background = "#4b5563"; // Gray out the button
        e.target.disabled = true;
    };
});

// ==========================================
// LOAD DASHBOARD WITH FULL CARDS & DELETE BUTTON
// ==========================================
async function loadDashboardData(uid) {
    const q = query(collection(db, 'saved_opportunities'), where('uid', '==', uid));
    const querySnapshot = await getDocs(q);
    const list = document.getElementById('saved-items-list');
    const countSpan = document.getElementById('saved-count');
    
    list.innerHTML = '';
    countSpan.innerText = querySnapshot.size;
    
    if(querySnapshot.empty) {
        list.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">You haven\'t saved any opportunities yet. Go back to Home to browse!</p>';
        return;
    }

    // Build identical cards for the dashboard
    querySnapshot.forEach((documentSnap) => {
        const data = documentSnap.data();
        const docId = documentSnap.id;
        
        const card = document.createElement('div');
        card.className = 'opportunity-card';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
                <div class="card-badge" style="margin-bottom:0;">${data.badge}</div>
                <button class="remove-btn" data-id="${docId}" title="Remove"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <h3>${data.title}</h3>
            <p class="desc">${data.desc}</p>
            <a href="${data.link}" target="_blank" class="btn-block">Official Details</a>
        `;
        list.appendChild(card);
    });

    // Attach delete functionality to the "X" marks
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            await deleteDoc(doc(db, 'saved_opportunities', id));
            loadDashboardData(currentUser.uid); // Reload UI
        };
    });
}

// Fetch Live User Stats
const statsRef = doc(db, 'platform', 'stats');
onSnapshot(statsRef, (doc) => {
    if(doc.exists()) {
        statsBar.innerText = `Live Stats: ${doc.data().totalUsers} Students Registered Globally!`;
    } else {
        statsBar.innerText = `Live Stats: 0 Students Registered.`;
    }
});