<script lang="ts">

  import { Card } from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Avatar, AvatarFallback, AvatarImage } from "$lib/components/ui/avatar";
  import { Tabs, TabsList, TabsTrigger, TabsContent } from "$lib/components/ui/tabs";
  import { Copy, Settings } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";


  /* =========================================
     TODO (Backend): Replace static user data
     Fetch from:
     - Auth session
     - Neon DB via Drizzle
     - DID identity service
  ========================================= */

  let name = "Veeranji Uppara";
  let username = "veeranji";
  let domain = "example.com";
  let bio = "Full stack developer passionate about decentralized web and cybersecurity.";

  /* =========================================
     TODO (Backend):
     Replace with user.profileImage
     URL from Vercel Blob storage
  ========================================= */
  let avatarUrl = "";


  /* =========================================
     TODO (Backend):
     Replace with real stats
     Example sources:
     - followers table
     - following table
     - posts table
  ========================================= */
  let followersCount = 120;
  let followingCount = 85;
  let postsCount = 42;


  /* =========================================
     Derived Handle
     Backend should provide username + domain
  ========================================= */
  $: handle = `@${username}@${domain}`;


  /* =========================================
     Share Profile Link
     (Frontend utility only)
  ========================================= */
  async function copyProfile() {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Profile link copied!");
  }

</script>



<div class="flex justify-center p-6 min-h-screen bg-muted">

  <Card class="w-full max-w-xl overflow-hidden shadow-lg">


    <!-- =========================================
         TODO (Backend):
         Replace static banner later
         Optional:
         - bannerImageUrl
         - Stored in Vercel Blob
    ========================================= -->
    <div class="h-32 bg-gradient-to-r from-indigo-500 to-purple-600" />



    <div class="flex flex-col items-center -mt-12">

      <!-- =========================================
           Avatar Section
           Backend should provide avatar URL
      ========================================= -->

      <Avatar class="w-24 h-24 border-4 border-background">

        {#if avatarUrl}
          <AvatarImage src={avatarUrl} />
        {:else}
          <AvatarFallback>VU</AvatarFallback>
        {/if}

      </Avatar>



      <!-- =========================================
           User Identity
           Backend should populate fields
      ========================================= -->

      <h2 class="text-2xl font-semibold mt-3">{name}</h2>
      <p class="text-muted-foreground">{handle}</p>



      <!-- =========================================
           Profile Action Buttons
      ========================================= -->

      <div class="flex gap-2 mt-3">

        <!-- TODO (Frontend + Backend):
             Settings route should verify auth session -->
        <Button onclick={() => goto("profile/settings/")}>
          <Settings class="w-4 h-4 mr-1" />
          Edit
        </Button>


        <!-- Share button purely frontend -->
        <Button variant="secondary" onclick={copyProfile}>
          <Copy class="w-4 h-4 mr-1" />
          Share
        </Button>

      </div>

    </div>



    <!-- =========================================
         TODO (Backend):
         Replace bio with user.bio from DB
    ========================================= -->
    <div class="px-6 pt-6 text-center">
      <p class="text-sm text-muted-foreground">{bio}</p>
    </div>



    <!-- =========================================
         Stats Section
         Backend should return aggregated counts
    ========================================= -->
    <div class="grid grid-cols-3 text-center py-6 border-t mt-6">

      <div>
        <p class="text-xl font-semibold">{followersCount}</p>
        <p class="text-sm text-muted-foreground">Followers</p>
      </div>

      <div>
        <p class="text-xl font-semibold">{followingCount}</p>
        <p class="text-sm text-muted-foreground">Following</p>
      </div>

      <div>
        <p class="text-xl font-semibold">{postsCount}</p>
        <p class="text-sm text-muted-foreground">Posts</p>
      </div>

    </div>



    <!-- =========================================
         Tabs Section
         Backend will supply tab content later
    ========================================= -->

    <Tabs defaultValue="posts" class="px-4 pb-6">

      <TabsList class="grid grid-cols-3">
        <TabsTrigger value="posts">Posts</TabsTrigger>
        <TabsTrigger value="about">About</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>



      <!-- =========================================
           TODO (Backend):
           Replace with posts feed API
           Example:
           GET /api/posts?userId=
      ========================================= -->
      <TabsContent value="posts">
        <div class="space-y-3 mt-4">

          <Card class="p-4">
            Placeholder post (Backend will replace)
          </Card>

        </div>
      </TabsContent>



      <!-- =========================================
           TODO (Backend):
           Could contain extended profile data
           Example:
           - skills
           - links
           - DID metadata
      ========================================= -->
      <TabsContent value="about">
        <div class="p-4 text-sm text-muted-foreground">
          Extended profile details will load here.
        </div>
      </TabsContent>



      <!-- =========================================
           TODO (Backend):
           Activity log integration
           Example:
           - user interactions
           - federated ActivityPub events
      ========================================= -->
      <TabsContent value="activity">
        <div class="p-4 text-sm text-muted-foreground">
          Activity timeline will appear here.
        </div>
      </TabsContent>

    </Tabs>

  </Card>
</div>
