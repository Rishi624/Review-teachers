document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const verifyForm = document.getElementById('verifyForm');
    const logoutButton = document.getElementById('logoutButton');
    const deleteAccountButton = document.getElementById('deleteAccountButton');
    const adminForm = document.getElementById('adminForm');
    const adminAuthForm = document.getElementById('adminAuthForm');

    const headerNameSpan = document.getElementById('headerName');
    const headerEmailSpan = document.getElementById('headerEmail');
    const greetMessage = document.getElementById('greetMessage');
    const yourContributionsButton = document.getElementById('yourContributionsButton');
    const addContributionsButton = document.getElementById('addContributionsButton');
    const feedbackButton = document.getElementById('feedbackButton');
    const seeAllContributionsButton = document.getElementById('seeAllContributionsButton');

    const contributionForm = document.getElementById('contributionForm');
    const contributionsListDiv = document.getElementById('contributionsList');
    const noContributionsP = document.getElementById('noContributions');

    const messageDisplay = document.getElementById('message');
    const teacherSearchInput = document.getElementById('teacherSearchInput');
    const teacherSearchButton = document.getElementById('teacherSearchButton');
    const searchResultsDiv = document.getElementById('searchResults');
    const searchResultsContentDiv = document.getElementById('searchResultsContent');

    const backendUrl = 'https://review-teachers.onrender.com';

    const displayMessage = (message, type) => {
        if (messageDisplay) {
            messageDisplay.textContent = message;
            messageDisplay.className = `message animated ${type}`;
            setTimeout(() => { messageDisplay.textContent = '', messageDisplay.className = 'message'; }, 5000);
        }
    };

    const fetchContributions = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await fetch(`${backendUrl}/api/contributions/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
            });

            const contributions = await response.json();
            
            if (response.ok) {
                if (contributions.length > 0) {
                    if (contributionsListDiv) contributionsListDiv.innerHTML = '';
                    if (noContributionsP) noContributionsP.style.display = 'none';
                    contributions.forEach(contrib => {
                        const card = document.createElement('div');
                        card.className = 'contribution-card animated';
                        card.innerHTML = `
                            <h3>${contrib.facultyName}</h3>
                            <p><strong>Email:</strong> ${contrib.facultyEmail}</p>
                            <p><strong>Rating:</strong> <span class="rating">${'★'.repeat(contrib.rating)}</span></p>
                            <p><strong>Review:</strong> ${contrib.review}</p>
                        `;
                        if (contributionsListDiv) contributionsListDiv.appendChild(card);
                    });
                } else {
                    if (noContributionsP) noContributionsP.style.display = 'block';
                }
            } else {
                displayMessage(contributions.message || 'Failed to load contributions.', 'error');
            }
        } catch (error) {
            console.error('Error fetching contributions:', error);
            displayMessage('An error occurred while fetching contributions.', 'error');
        }
    };

    const checkLoginStatus = async () => {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));

        if (!token || !user) {
            if (window.location.pathname.endsWith('dashboard.html') || window.location.pathname.endsWith('your-contributions.html') || window.location.pathname.endsWith('add-contribution.html')) {
                setTimeout(() => { window.location.href = 'login.html'; }, 1500);
            }
            return;
        }

        if (headerNameSpan) headerNameSpan.textContent = user.name;
        if (headerEmailSpan) headerEmailSpan.textContent = user.email;

        if (window.location.pathname.endsWith('dashboard.html')) {
            if (greetMessage) greetMessage.textContent = `Welcome, ${user.name}!`;
        }

        if (window.location.pathname.endsWith('your-contributions.html')) {
            fetchContributions();
        }
    };

    checkLoginStatus();

    if (signupForm) {
        signupForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const name = signupForm.elements.name.value;
            const email = signupForm.elements.email.value;
            const password = signupForm.elements.password.value;
            const gitamEmailRegex = /^[a-zA-Z0-9._%+-]+@student\.gitam\.edu$/;
            if (!gitamEmailRegex.test(email)) {
                displayMessage('Invalid email. Only @student.gitam.edu emails are allowed.', 'error');
                return;
            }
            try {
                const response = await fetch(`${backendUrl}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password }),
                });
                const data = await response.json();
                if (response.ok) {
                    displayMessage(data.message, 'success');
                    signupForm.reset();
                    localStorage.setItem('emailToVerify', email);
                    setTimeout(() => { window.location.href = 'verify.html'; }, 1500);
                } else {
                    displayMessage(data.message || 'Registration failed.', 'error');
                }
            } catch (error) {
                console.error('Error during registration:', error);
                displayMessage('An error occurred. Please try again later.', 'error');
            }
        });
    }

    if (verifyForm) {
        const emailToVerify = localStorage.getItem('emailToVerify');
        if (emailToVerify) verifyForm.elements.email.value = emailToVerify;
        verifyForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = verifyForm.elements.email.value;
            const code = verifyForm.elements.code.value;
            try {
                const response = await fetch(`${backendUrl}/verify-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code }),
                });
                const data = await response.json();
                if (response.ok) {
                    displayMessage(data.message, 'success');
                    localStorage.removeItem('emailToVerify');
                    verifyForm.reset();
                    setTimeout(() => { window.location.href = 'login.html'; }, 2000);
                } else {
                    displayMessage(data.message || 'Verification failed.', 'error');
                }
            } catch (error) {
                console.error('Error during verification:', error);
                displayMessage('An error occurred. Please try again later.', 'error');
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = loginForm.elements.email.value;
            const password = loginForm.elements.password.value;
            try {
                const response = await fetch(`${backendUrl}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const data = await response.json();
                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    displayMessage(data.message, 'success');
                    loginForm.reset();
                    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
                } else {
                    displayMessage(data.message || 'Login failed.', 'error');
                    if (data.message && data.message.includes('verify your email')) {
                         localStorage.setItem('emailToVerify', email);
                         setTimeout(() => { window.location.href = 'verify.html'; }, 1000);
                    }
                }
            } catch (error) {
                console.error('Error during login:', error);
                displayMessage('An error occurred. Please try again later.', 'error');
            }
        });
    }

    if (contributionForm) {
        contributionForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const token = localStorage.getItem('token');
            if (!token) return displayMessage('You must be logged in to contribute.', 'error');
            const facultyName = contributionForm.elements.facultyName.value;
            const facultyEmail = contributionForm.elements.facultyEmail.value;
            const rating = contributionForm.elements.rating.value;
            const review = contributionForm.elements.review.value;
            try {
                const response = await fetch(`${backendUrl}/api/contributions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ facultyName, facultyEmail, rating, review }),
                });
                const data = await response.json();
                if (response.ok) {
                    displayMessage(data.message, 'success');
                    contributionForm.reset();
                    setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
                } else {
                    displayMessage(data.message || 'Contribution failed.', 'error');
                }
            } catch (error) {
                console.error('Error submitting contribution:', error);
                displayMessage('An error occurred while submitting contribution.', 'error');
            }
        });
    }

    if (yourContributionsButton) {
        yourContributionsButton.addEventListener('click', () => { window.location.href = 'your-contributions.html'; });
    }
    if (addContributionsButton) {
        addContributionsButton.addEventListener('click', () => { window.location.href = 'add-contribution.html'; });
    }
    if (seeAllContributionsButton) {
        seeAllContributionsButton.addEventListener('click', async () => {
            const searchResultsContentDiv = document.getElementById('searchResultsContent');
            if (searchResultsContentDiv) searchResultsContentDiv.innerHTML = 'Loading all contributions...';

            try {
                const response = await fetch(`${backendUrl}/api/contributions/search?query=`);
                const data = await response.json();
                if (response.ok) {
                    if (searchResultsDiv) searchResultsDiv.style.display = 'block';
                    searchResultsContentDiv.innerHTML = `
                        <div class="search-result-header">
                            <h3>All Contributions</h3>
                        </div>
                        <div class="reviews-list">
                            ${data.allReviews.map(contrib => `
                                <div class="review-card animated">
                                    <p><strong>Faculty:</strong> ${contrib.facultyName}</p>
                                    <p><strong>Email:</strong> ${contrib.facultyEmail}</p>
                                    <p><strong>Rating:</strong> <span class="rating">${'★'.repeat(contrib.rating)}</span></p>
                                    <p><strong>Review:</strong> ${contrib.review}</p>
                                    <p style="font-size: 0.8em; color: #777;"><em>Submitted by: ${contrib.reviewerName} on: ${new Date(contrib.createdAt).toLocaleDateString()}</em></p>
                                </div>
                            `).join('')}
                        </div>
                    `;
                } else {
                    if (searchResultsDiv) searchResultsDiv.style.display = 'block';
                    searchResultsContentDiv.innerHTML = `<p class="message error">${data.message || 'Search failed.'}</p>`;
                }
            } catch (error) {
                console.error('Error during search:', error);
                displayMessage('An error occurred while fetching all contributions.', 'error');
                if (searchResultsDiv) searchResultsDiv.style.display = 'none';
            }
        });
    }

    if (teacherSearchButton) {
        teacherSearchButton.addEventListener('click', async () => {
            const query = teacherSearchInput.value;
            if (!query) {
                return displayMessage('Please enter a teacher\'s name or email to search.', 'error');
            }
            if (searchResultsDiv) searchResultsDiv.style.display = 'none';
            try {
                const response = await fetch(`${backendUrl}/api/contributions/search?query=${encodeURIComponent(query)}`);
                const data = await response.json();
                if (response.ok) {
                    if (searchResultsDiv && searchResultsContentDiv) {
                        searchResultsDiv.style.display = 'block';
                        searchResultsContentDiv.innerHTML = `
                            <div class="search-result-header">
                                <h3>${data.facultyName}</h3>
                                <p><strong>Email:</strong> ${data.facultyEmail}</p>
                                <p><strong>Average Rating:</strong> <span class="rating">${'★'.repeat(Math.round(data.averageRating))} (${data.averageRating})</span></p>
                            </div>
                            <div class="reviews-list">
                                <h4>All Reviews:</h4>
                                ${data.reviews.map(review => `
                                    <div class="review-card animated">
                                        <p><strong>Reviewer:</strong> ${review.reviewerName}</p>
                                        <p><strong>Rating:</strong> <span class="rating">${'★'.repeat(review.rating)}</span></p>
                                        <p>${review.review}</p>
                                        <p style="font-size: 0.8em; color: #777;"><em>Submitted on: ${new Date(review.createdAt).toLocaleDateString()}</em></p>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }
                } else {
                    if (searchResultsDiv && searchResultsContentDiv) {
                        searchResultsDiv.style.display = 'block';
                        searchResultsContentDiv.innerHTML = `<p class="message error">${data.message || 'Search failed.'}</p>`;
                    }
                }
            } catch (error) {
                console.error('Error during search:', error);
                displayMessage('An error occurred while searching. Please try again later.', 'error');
                if (searchResultsDiv) searchResultsDiv.style.display = 'none';
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('token'); localStorage.removeItem('user');
            alert('You have been logged out.'); window.location.href = 'login.html';
        });
    }
    if (deleteAccountButton) {
        deleteAccountButton.addEventListener('click', async () => {
            const isConfirmed = confirm('Are you sure you want to delete your account? This action is permanent and cannot be undone.');
            if (!isConfirmed) return;
            const token = localStorage.getItem('token');
            if (!token) return displayMessage('You must be logged in to delete your account.', 'error');
            try {
                const response = await fetch(`${backendUrl}/api/account`, {
                    method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` },
                });
                const data = await response.json();
                if (response.ok) {
                    displayMessage(data.message, 'success');
                    localStorage.removeItem('token'); localStorage.removeItem('user');
                    setTimeout(() => { window.location.href = 'signup.html'; }, 2000);
                } else {
                    displayMessage(data.message || 'Failed to delete account.', 'error');
                }
            } catch (error) {
                console.error('Error deleting account:', error);
                displayMessage('An error occurred while deleting your account.', 'error');
            }
        });
    }
    
    if (adminAuthForm) {
        adminAuthForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const adminAuthPassword = adminAuthForm.elements.adminAuthPassword.value;
            try {
                const response = await fetch(`${backendUrl}/api/admin/auth`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminPassword: adminAuthPassword }),
                });
                const data = await response.json();
                if (response.ok) {
                    authMessageP.textContent = 'Authentication successful!';
                    authMessageP.className = 'message success';
                    setTimeout(() => {
                        passwordGateDiv.style.display = 'none';
                        adminPanelDiv.style.display = 'block';
                    }, 1000);
                } else {
                    authMessageP.textContent = data.message || 'Authentication failed.';
                    authMessageP.className = 'message error';
                }
            } catch (error) {
                console.error('Admin auth error:', error);
                authMessageP.textContent = 'An error occurred during authentication.';
                authMessageP.className = 'message error';
            }
        });
    }

    if (viewAllContributionsButton) {
        viewAllContributionsButton.addEventListener('click', async () => {
            allContributionsListDiv.innerHTML = 'Loading all contributions...';
            try {
                const response = await fetch(`${backendUrl}/api/contributions/all`);
                const contributions = await response.json();
                if (response.ok) {
                    if (contributions.length > 0) {
                        allContributionsListDiv.innerHTML = contributions.map(contrib => `
                            <div class="contribution-card animated">
                                <h3>${contrib.facultyName}</h3>
                                <p><strong>User Email:</strong> ${contrib.user.email}</p>
                                <p><strong>Rating:</strong> <span class="rating">${'★'.repeat(contrib.rating)}</span></p>
                                <p><strong>Review:</strong> ${contrib.review}</p>
                                <p style="font-size: 0.8em; color: #777;"><strong>Contribution ID:</strong> ${contrib._id}</p>
                            </div>
                        `).join('');
                    } else {
                        allContributionsListDiv.innerHTML = '<p class="message success">No contributions have been made yet.</p>';
                    }
                } else {
                    allContributionsListDiv.innerHTML = `<p class="message error">${contributions.message || 'Failed to load contributions.'}</p>`;
                }
            } catch (error) {
                console.error('Error fetching all contributions:', error);
                allContributionsListDiv.innerHTML = `<p class="message error">An error occurred while fetching contributions.</p>`;
            }
        });
    }

    if (deleteUserForm) {
        deleteUserForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const userEmailToDelete = deleteUserForm.elements.userEmailToDelete.value;
            const adminAuthPassword = document.getElementById('adminAuthPassword').value;
            const isConfirmed = confirm(`Are you sure you want to delete user ${userEmailToDelete}? This is permanent.`);
            if (!isConfirmed) return;
            try {
                const response = await fetch(`${backendUrl}/api/admin/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminPassword: adminAuthPassword, userEmailToDelete }),
                });
                const data = await response.json();
                if (response.ok) {
                    adminMessageP.textContent = data.message;
                    adminMessageP.className = 'message success';
                    deleteUserForm.reset();
                } else {
                    adminMessageP.textContent = data.message || 'Deletion failed.';
                    adminMessageP.className = 'message error';
                }
            } catch (error) {
                console.error('User deletion error:', error);
                adminMessageP.textContent = 'An error occurred during user deletion.';
                adminMessageP.className = 'message error';
            }
        });
    }

    if (deleteContributionForm) {
        deleteContributionForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const contributionIdToDelete = deleteContributionForm.elements.contributionIdToDelete.value;
            const adminAuthPassword = document.getElementById('adminAuthPassword').value;
            const isConfirmed = confirm(`Are you sure you want to delete contribution ${contributionIdToDelete}? This is permanent.`);
            if (!isConfirmed) return;
            try {
                const response = await fetch(`${backendUrl}/api/admin/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminPassword: adminAuthPassword, contributionIdToDelete }),
                });
                const data = await response.json();
                if (response.ok) {
                    adminMessageP.textContent = data.message;
                    adminMessageP.className = 'message success';
                    deleteContributionForm.reset();
                } else {
                    adminMessageP.textContent = data.message || 'Deletion failed.';
                    adminMessageP.className = 'message error';
                }
            } catch (error) {
                console.error('Contribution deletion error:', error);
                adminMessageP.textContent = 'An error occurred during contribution deletion.';
                adminMessageP.className = 'message error';
            }
        });
    }
});