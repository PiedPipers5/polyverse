<script lang="ts">
	import { Github, Twitter, Linkedin, Mail } from 'lucide-svelte';

	const footerSections = [
		{
			title: 'Product',
			links: [
				{ label: 'Features', href: '#features' },
				{ label: 'Pricing', href: '#pricing' },
				{ label: 'Security', href: '#security' },
				{ label: 'Roadmap', href: '#roadmap' }
			]
		},
		{
			title: 'Company',
			links: [
				{ label: 'About', href: '#about' },
				{ label: 'Blog', href: '#blog' },
				{ label: 'Careers', href: '#careers' },
				{ label: 'Contact', href: '#contact' }
			]
		},
		{
			title: 'Resources',
			links: [
				{ label: 'Documentation', href: '#docs' },
				{ label: 'API Reference', href: '#api' },
				{ label: 'Community', href: '#community' },
				{ label: 'Support', href: '#support' }
			]
		},
		{
			title: 'Legal',
			links: [
				{ label: 'Privacy', href: '#privacy' },
				{ label: 'Terms', href: '#terms' },
				{ label: 'Cookies', href: '#cookies' },
				{ label: 'Licenses', href: '#licenses' }
			]
		}
	];

	const socialLinks = [
		{ icon: Github, href: 'https://github.com/PiedPipers5/polyverse', label: 'GitHub' },
		{ icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
		{ icon: Linkedin, href: 'https://linkedin.com', label: 'LinkedIn' },
		{ icon: Mail, href: 'mailto:hello@polyverse.com', label: 'Email' }
	];

	const currentYear = new Date().getFullYear();
</script>

<footer class="border-t border-border bg-muted/30">
	<div class="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
		<!-- Main Footer Content -->
		<div class="mb-12 grid grid-cols-2 gap-8 md:grid-cols-5">
			<!-- Brand Column -->
			<div class="col-span-2 md:col-span-1">
				<a href="/" class="group mb-4 flex items-center space-x-2">
					<div
						class="flex h-10 w-10 transform items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 transition-transform group-hover:scale-110"
					>
						<span class="text-xl font-bold text-white">Pp</span>
					</div>
					<span class="gradient-text text-xl font-bold">POLYVERSE</span>
				</a>
				<p class="mb-6 text-sm text-foreground/60">
					Empowering digital sovereignty through federated social networking.
				</p>

				<!-- Social Links -->
				<div class="flex items-center space-x-4">
					{#each socialLinks as social}
						<a
							href={social.href}
							aria-label={social.label}
							class="glass-card flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-violet-500/20"
							target="_blank"
							rel="noopener noreferrer"
						>
							<svelte:component this={social.icon} class="h-4 w-4" />
						</a>
					{/each}
				</div>
			</div>

			<!-- Link Columns -->
			{#each footerSections as section}
				<div>
					<h3 class="mb-4 text-sm font-semibold">{section.title}</h3>
					<ul class="space-y-3">
						{#each section.links as link}
							<li>
								<a
									href={link.href}
									class="text-sm text-foreground/60 transition-colors hover:text-foreground"
								>
									{link.label}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>

		<!-- Bottom Bar -->
		<div
			class="flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row"
		>
			<p class="text-sm text-foreground/60">
				© {currentYear} Piedpipers. All rights reserved.
			</p>
			<div class="flex items-center space-x-6">
				<a
					href="#privacy"
					class="text-sm text-foreground/60 transition-colors hover:text-foreground"
				>
					Privacy Policy
				</a>
				<a href="#terms" class="text-sm text-foreground/60 transition-colors hover:text-foreground">
					Terms of Service
				</a>
			</div>
		</div>
	</div>
</footer>
<!-- Polyverse Branding - Full Width Hero Text (Outside Container) -->
<div class="relative w-full overflow-hidden bg-muted/30 py-5">
	<h2
		class="gradient-text w-full text-center text-[22vw] leading-none font-black uppercase sm:text-[20vw] md:text-[18vw]"
		style="letter-spacing: -0.1em;"
	>
		polyverse
	</h2>
</div>
