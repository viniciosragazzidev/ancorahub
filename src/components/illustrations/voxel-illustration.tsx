import { cn } from "@/lib/utils";

const voxelIllustrations = {
  "document-review": "/illustrations/voxel/document-review.png",
  "empty-inbox": "/illustrations/voxel/empty-inbox.png",
  "integration-hub": "/illustrations/voxel/integration-hub.png",
  "ocean-anchor": "/illustrations/voxel/ocean-anchor.png",
  "onboarding-compass": "/illustrations/voxel/onboarding-compass.png",
} as const;

type VoxelIllustrationName = keyof typeof voxelIllustrations;

type VoxelIllustrationProps = {
  name: VoxelIllustrationName;
  className?: string;
};

/** Decorative, low-emphasis illustrations for guidance and empty states. */
export function VoxelIllustration({ name, className }: VoxelIllustrationProps) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={cn(
        "pointer-events-none block max-h-full max-w-full select-none object-contain opacity-50 dark:opacity-40",
        className,
      )}
      decoding="async"
      loading="lazy"
      src={voxelIllustrations[name]}
    />
  );
}
