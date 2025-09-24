import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded-none border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black file:border-0 file:bg-transparent file:text-sm file:font-bold placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:cursor-not-allowed disabled:opacity-50 neobrutalism-input",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
