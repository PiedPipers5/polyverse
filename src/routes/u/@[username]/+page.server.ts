import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/* =========================================
   TODO (Backend Integration):
   This is currently a MOCK implementation for frontend testing.
   
   To integrate with real database:
   1. Uncomment database imports (db, users schema, eq from drizzle-orm)
   2. Replace mockUsers object with actual database query
   3. Extract profile data from DID document JSON (ActivityPub Actor format)
   
   Database fields to fetch:
   - username (text)
   - didDocument (jsonb) - contains name, summary, icon.url
   - createdAt (timestamp)
   
   DID Document structure (ActivityPub Actor):
   {
	 "name": "Display Name",      // → displayName
	 "summary": "User bio",        // → bio
	 "icon": { "url": "..." }      // → avatarUrl
   }
========================================= */

// MOCK VERSION - Frontend only, no database required
export const load: PageServerLoad = async ({ params }) => {
	let username = params.username;

	// TODO (Backend): Replace this mock data with database query
	// Example: const user = await db.query.users.findFirst({ where: eq(users.username, username) })
	const mockUsers: Record<string, any> = {
		veeranji: {
			username: 'veeranji',
			displayName: 'Veeranji Uppara',
			bio: 'Full stack developer passionate about decentralized web and cybersecurity.',
			avatarUrl: '',
			createdAt: new Date('2024-01-15')
		},
		alice: {
			username: 'alice',
			displayName: 'Alice Smith',
			bio: 'Software engineer and open source enthusiast.',
			avatarUrl: '',
			createdAt: new Date('2024-02-01')
		},
		bob: {
			username: 'bob',
			displayName: 'Bob Johnson',
			bio: 'Designer and creative developer.',
			avatarUrl: '',
			createdAt: new Date('2024-03-10')
		}
	};

	// TODO (Backend): Replace with actual database lookup
	const user = mockUsers[username.toLowerCase()];

	if (!user) {
		// 404 handling works the same for real database
		error(404, 'User not found');
	}

	// TODO (Backend): Extract from DID document instead of direct fields
	// Example:
	// const didDoc = user.didDocument as any;
	// const displayName = didDoc?.name || username;
	// const bio = didDoc?.summary || '';
	// const avatarUrl = didDoc?.icon?.url || '';

	return {
		profile: {
			username: user.username,
			displayName: user.displayName, // TODO: Extract from didDocument.name
			bio: user.bio, // TODO: Extract from didDocument.summary
			avatarUrl: user.avatarUrl, // TODO: Extract from didDocument.icon.url
			handle: `@${user.username}`,
			createdAt: user.createdAt,
			// TODO (Backend): When implementing social features, replace with real counts
			// Example: await countFollowers(user.id), await countFollowing(user.id), etc.
			followersCount: 0,
			followingCount: 0,
			postsCount: 0
		}
	};
};
