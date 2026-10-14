import { Component as ThreeDButton } from "@/components/ui/3d-button";

export function Demo() {
  return (
    <div className="flex min-h-[200px] w-full items-center justify-center p-8">
      <ThreeDButton href="/signup" />
    </div>
  );
}

export default Demo;
