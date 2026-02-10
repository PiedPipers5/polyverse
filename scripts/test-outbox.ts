#!/usr/bin/env bun

/**
 * Comprehensive integration test for EPIC 2
 * Creates test data and verifies all functionality
 */

const BASE_URL = 'http://localhost:5173';

async function registerUser(username: string, password: string) {
    const response = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    return response;
}

async function login(username: string, password: string) {
    const response = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
    });
    
    // Extract auth cookie
    const setCookie = response.headers.get('set-cookie');
    return setCookie;
}

async function createPost(authCookie: string, content: string, privacy: string = 'public') {
    const response = await fetch(`${BASE_URL}/users/testuser/outbox`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': authCookie || ''
        },
        body: JSON.stringify({ content, privacy })
    });
    return response;
}

async function getOutbox(username: string, page?: number) {
    const url = page 
        ? `${BASE_URL}/users/${username}/outbox?page=${page}`
        : `${BASE_URL}/users/${username}/outbox`;
    
    const response = await fetch(url, {
        headers: { 'Accept': 'application/activity+json' }
    });
    return response;
}

async function runIntegrationTest() {
    console.log('='.repeat(70));
    console.log('EPIC 2 - Comprehensive Integration Test');
    console.log('='.repeat(70));
    
    let authCookie = '';
    
    try {
        // Step 1: Register a test user
        console.log('\n[1/7] Registering test user...');
        const registerResp = await registerUser('testuser', 'TestPassword123!');
        
        if (registerResp.status === 201 || registerResp.status === 200) {
            console.log('✓ User registered successfully');
        } else if (registerResp.status === 409) {
            console.log('✓ User already exists (continuing with existing user)');
        } else {
            console.log(`✗ Registration failed: ${registerResp.status}`);
            const text = await registerResp.text();
            console.log('Response:', text);
        }
        
        // Step 2: Login
        console.log('\n[2/7] Logging in...');
        const cookie = await login('testuser', 'TestPassword123!');
        if (cookie) {
            authCookie = cookie;
            console.log('✓ Login successful');
        } else {
            console.log('✗ Login failed - cannot proceed with tests');
            return;
        }
        
        // Step 3: Create test posts
        console.log('\n[3/7] Creating test posts...');
        
        const posts = [
            { content: 'Public post #1', privacy: 'public' },
            { content: 'Public post #2', privacy: 'public' },
            { content: 'Unlisted post #1', privacy: 'unlisted' },
            { content: 'Followers-only post #1', privacy: 'followers' },
        ];
        
        for (const post of posts) {
            const resp = await createPost(authCookie, post.content, post.privacy);
            if (resp.status === 201) {
                console.log(`  ✓ Created ${post.privacy} post`);
            } else {
                console.log(`  ✗ Failed to create ${post.privacy} post: ${resp.status}`);
            }
        }
        
        // Step 4: Test root OrderedCollection
        console.log('\n[4/7] Testing root OrderedCollection...');
        const rootResp = await getOutbox('testuser');
        
        if (rootResp.ok) {
            const data = await rootResp.json();
            console.log(`  Type: ${data.type}`);
            console.log(`  Total Items: ${data.totalItems}`);
            console.log(`  First: ${data.first}`);
            
            if (data.type === 'OrderedCollection' && typeof data.totalItems === 'number') {
                console.log('✓ Root OrderedCollection structure correct');
            } else {
                console.log('✗ Root OrderedCollection structure incorrect');
            }
        } else {
            console.log(`✗ Failed to fetch root collection: ${rootResp.status}`);
        }
        
        // Step 5: Test paginated page
        console.log('\n[5/7] Testing OrderedCollectionPage (page 1)...');
        const pageResp = await getOutbox('testuser', 1);
        
        if (pageResp.ok) {
            const data = await pageResp.json();
            console.log(`  Type: ${data.type}`);
            console.log(`  Items count: ${data.orderedItems?.length || 0}`);
            console.log(`  Has next: ${!!data.next}`);
            console.log(`  Has prev: ${!!data.prev}`);
            
            if (data.type === 'OrderedCollectionPage' && Array.isArray(data.orderedItems)) {
                console.log('✓ OrderedCollectionPage structure correct');
            } else {
                console.log('✗ OrderedCollectionPage structure incorrect');
            }
        } else {
            console.log(`✗ Failed to fetch page: ${pageResp.status}`);
        }
        
        // Step 6: Test content-type header
        console.log('\n[6/7] Testing Content-Type header...');
        const contentType = rootResp.headers.get('content-type');
        if (contentType?.includes('application/activity+json')) {
            console.log(`✓ Correct content-type: ${contentType}`);
        } else {
            console.log(`✗ Wrong content-type: ${contentType}`);
        }
        
        // Step 7: Test invalid page number
        console.log('\n[7/7] Testing invalid page number handling...');
        const invalidResp = await getOutbox('testuser', 0);
        if (invalidResp.status === 400) {
            console.log('✓ Invalid page number rejected with 400');
        } else {
            console.log(`✗ Expected 400, got ${invalidResp.status}`);
        }
        
        console.log('\n' + '='.repeat(70));
        console.log('✓ Integration test completed!');
        console.log('='.repeat(70));
        
    } catch (error) {
        console.error('\n✗ Test failed with error:', error);
    }
}

runIntegrationTest();
