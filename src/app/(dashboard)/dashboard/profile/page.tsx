import { prisma } from "@/lib/db";
import { StyleProfileEditor } from "@/components/profile/style-profile-editor";
import { ContentSampleList } from "@/components/profile/content-sample-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function ProfilePage() {
  // Fetch style profile and content samples
  const [styleProfile, contentSamples] = await Promise.all([
    prisma.styleProfile.findFirst(),
    prisma.contentSample.findMany({
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="h-full">
      <header className="border-b px-6 py-4">
        <h1 className="font-serif text-xl font-medium">Your Profile</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Teach PostMaster your writing style
        </p>
      </header>

      <div className="p-6">
        <Tabs defaultValue="style" className="mx-auto max-w-3xl">
          <TabsList className="mb-6">
            <TabsTrigger value="style">Writing Style</TabsTrigger>
            <TabsTrigger value="samples">Content Samples</TabsTrigger>
          </TabsList>

          <TabsContent value="style">
            <StyleProfileEditor
              initialProfile={
                styleProfile
                  ? {
                      bio: styleProfile.bio || "",
                      context: styleProfile.context || "",
                      tone: styleProfile.tone || "",
                      voice: styleProfile.voice || "",
                      vocabulary: styleProfile.vocabulary || "",
                      sentence: styleProfile.sentence || "",
                      patterns: styleProfile.patterns || "",
                      overrides: styleProfile.overrides || "",
                    }
                  : null
              }
            />
          </TabsContent>

          <TabsContent value="samples">
            <ContentSampleList
              initialSamples={contentSamples.map((s) => ({
                id: s.id,
                url: s.url,
                title: s.title || undefined,
                wordCount: s.wordCount || undefined,
                analyzedAt: s.analyzedAt?.toISOString() || undefined,
              }))}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
