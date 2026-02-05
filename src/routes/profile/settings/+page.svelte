<script lang="ts">

  import { Card, CardHeader, CardTitle, CardContent } from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Avatar, AvatarFallback } from "$lib/components/ui/avatar";
  import { toast } from "svelte-sonner";
  import { Copy } from "lucide-svelte";


  /* =========================================
     TODO (Backend)
     Replace with real user data
  ========================================= */

  let name = "Veeranji Uppara";
  let username = "veeranji";
  let domain = "example.com";
  let bio = "Full stack developer passionate about decentralized web.";
  let did = "did:web:example.com:user:veeranji";


  /* Derived handle */
  $: handle = `@${username}@${domain}`;


  /* =========================================
     Copy Helpers
  ========================================= */

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Copied!");
  }


  /* =========================================
     TODO (Backend)
     Send updated profile data to API
  ========================================= */

  function saveProfile() {
    toast.success("Profile saved (frontend demo)");
  }

</script>



<div class="flex justify-center p-6 min-h-screen bg-muted">

<Card class="w-full max-w-2xl shadow-lg">

<CardHeader>
<CardTitle>Profile Settings</CardTitle>
</CardHeader>


<CardContent class="space-y-8">


  <!-- ===============================
       Avatar Section
  ================================ -->

  <div class="space-y-2">

    <label class="font-medium">Profile Picture</label>

    <div class="flex items-center gap-4">

      <Avatar class="w-16 h-16">
        <AvatarFallback>VU</AvatarFallback>
      </Avatar>

      <!-- TODO (Backend)
           Upload image to Vercel Blob -->
      <Button variant="secondary">
        Upload Avatar
      </Button>

    </div>

  </div>



  <!-- ===============================
       Name Section
  ================================ -->

  <div class="space-y-2">

    <label class="font-medium">Display Name</label>

    <Input bind:value={name} />

  </div>



  <!-- ===============================
       Username Section
  ================================ -->

  <div class="space-y-2">

    <label class="font-medium">Username</label>

    <!-- TODO (Backend): Validate username uniqueness -->
    <Input bind:value={username} />

  </div>



  <!-- ===============================
       Bio Section
  ================================ -->

  <div class="space-y-2">

    <label class="font-medium">Bio</label>

    <Textarea rows={3} bind:value={bio} />

  </div>



  <!-- ===============================
       Handle Display
  ================================ -->

  <div class="space-y-2">

    <label class="font-medium">Your Handle</label>

    <div class="flex gap-2">

      <Input readonly value={handle} />

      <Button size="icon" onclick={() => copy(handle)}>
        <Copy class="w-4 h-4" />
      </Button>

    </div>

  </div>



  <!-- ===============================
       DID Identity Section
  ================================ -->

  <div class="space-y-2">

    <label class="font-medium">Decentralized Identity (DID)</label>

    <div class="flex gap-2">

      <Input readonly value={did} />

      <Button size="icon" onclick={() => copy(did)}>
        <Copy class="w-4 h-4" />
      </Button>

    </div>

  </div>



  <!-- ===============================
       Save Button
  ================================ -->

  <div class="flex justify-end pt-4 border-t">

    <Button onclick={saveProfile}>
      Save Changes
    </Button>

  </div>


</CardContent>
</Card>
</div>
