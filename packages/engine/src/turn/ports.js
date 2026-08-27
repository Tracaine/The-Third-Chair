import { z } from "zod";
export const NarrationSchema = z.object({
    sceneText: z.string().trim().min(1).max(8_000),
    spokenNpcLines: z.array(z.string().trim().max(2_000)),
    mustIncludeResolutionIds: z.array(z.string()),
    mustIncludeEventIds: z.array(z.string()),
    visibleEventIds: z.array(z.string()),
}).strict();
//# sourceMappingURL=ports.js.map