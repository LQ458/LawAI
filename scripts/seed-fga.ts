import { fgaWriteTuples } from "../lib/fga";
import { DEMO_FGA_TUPLES } from "../lib/demoData";

async function seed() {
  console.log("Seeding FGA tuples...");

  try {
    await fgaWriteTuples(
      DEMO_FGA_TUPLES.map((t) => ({
        user: t.user,
        relation: t.relation,
        object: t.object,
      })),
    );
    console.log(`Successfully seeded ${DEMO_FGA_TUPLES.length} FGA tuples`);
  } catch (error) {
    console.error("Error seeding FGA tuples:", error);
    process.exit(1);
  }
}

seed();
