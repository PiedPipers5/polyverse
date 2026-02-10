<script lang="ts">
	import Navbar from '$lib/components/landing/navbar.svelte';
	import HeroSection from '$lib/components/landing/hero-section.svelte';
	import FeaturesGrid from '$lib/components/landing/features-grid.svelte';
	import StatsSection from '$lib/components/landing/stats-section.svelte';
	import CtaSection from '$lib/components/landing/cta-section.svelte';
	import Footer from '$lib/components/landing/footer.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>POLYVERSE - Federated Social Network for Digital Sovereignty</title>
	<meta
		name="description"
		content="Join POLYVERSE, a decentralized federated social network built on privacy, security, and user autonomy. Own your data, control your identity, and communicate freely across the federation."
	/>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="min-h-screen">
	<Navbar user={data.user} />
	<main>
		<HeroSection user={data.user} />
		<FeaturesGrid />
		<StatsSection />
		<CtaSection user={data.user} />
	</main>
	<Footer />
</div>
