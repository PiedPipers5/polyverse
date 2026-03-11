import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { followers, remoteActors } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { resolveRemoteActor } from '$lib/server/federation';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const handle = params.handle;
	
	// 1. Resolve Remote Actor
	const resolved = await resolveRemoteActor(handle);
	if (!resolved) {
		throw error(404, 'Remote user not found or unreachable');
	}
	
	const { actor, handle: normalizedHandle } = resolved;
	
	// 2. Format Profile Data
	const preferredUsername = (actor.preferredUsername as string) || normalizedHandle.split('@')[0];
	const name = (actor.name as string) || preferredUsername;
	const icon = actor.icon as { url: string } | undefined;
	const summary = (actor.summary as string) || '';
	
	const profile = {
		id: actor.id as string,
		username: preferredUsername,
		displayName: name,
		bio: summary.replace(/<[^>]*>/g, '').trim(), // Strip HTML from Mastodon
		avatarUrl: icon?.url || null,
		handle: `@${normalizedHandle}`,
		createdAt: actor.published ? new Date(actor.published as string) : new Date(),
		followersCount: 0, // Hard to fetch reliably for remote users without an extra API call
		followingCount: 0,
		postsCount: 0,
		isRemote: true
	};

	// 3. Fetch Follow Status
	let followStatus: 'none' | 'pending' | 'accepted' = 'none';
	const requestor = locals.user;
	
	if (requestor) {
		// Look up internal ID of the remote actor
		const remoteActorModel = await db.query.remoteActors.findFirst({
			where: eq(remoteActors.handle, normalizedHandle),
			columns: { id: true }
		});
		
		if (remoteActorModel) {
			const followRecord = await db.query.followers.findFirst({
				where: and(
					eq(followers.remoteUserId, remoteActorModel.id),
					eq(followers.followerId, requestor.userId)
				)
			});
			if (followRecord) {
				followStatus = followRecord.status as 'pending' | 'accepted';
			}
		}
	}

	// 4. Fetch Outbox (Recent Posts)
	let activities: any[] = [];
	try {
		if (actor.outbox && typeof actor.outbox === 'string') {
			const outboxRes = await fetch(actor.outbox, {
				headers: { Accept: 'application/activity+json' }
			});
			
			if (outboxRes.ok) {
				const outboxData = await outboxRes.json();
				let firstPage = outboxData.first;
				
				// Handle both embedded page and URL reference
				if (typeof firstPage === 'string') {
					const pageRes = await fetch(firstPage, {
						headers: { Accept: 'application/activity+json' }
					});
					if (pageRes.ok) {
						const pageData = await pageRes.json();
						firstPage = pageData;
					} else {
						firstPage = null;
					}
				}
				
				if (firstPage && firstPage.orderedItems) {
					// Format items to roughly match local structure expected by Post.svelte
					activities = firstPage.orderedItems
						// Mastodon often embeds the object inside a Create activity, or returns the Note directly
						.filter((item: any) => item.type === 'Create' || item.type === 'Note')
						.map((item: any) => {
							const obj = item.type === 'Create' ? item.object : item;
							if (!obj) return null;
							
							return {
								id: obj.id,
								type: 'Create',
								createdAt: new Date(obj.published || new Date()),
								publishedAt: new Date(obj.published || new Date()),
								activity: {
									id: item.id || obj.id,
									type: 'Create',
									actor: profile.id, // Remote actor URI
									object: obj
								},
								// The Svelte component expects content on the top level or object
								content: obj.content || ''
							};
						})
						.filter(Boolean)
						.slice(0, 5); // Limit to top 5 for fast display
				}
			}
		}
	} catch (err) {
		console.error('Failed to fetch remote outbox:', err);
		// Fail gracefully and just show an empty feed
	}

	return {
		profile,
		activities,
		isOwner: false, // You can never own a remote profile
		followStatus,
		nextCursor: null, // Remote pagination can be complex, skipping for v1
		hasMore: false
	};
};
