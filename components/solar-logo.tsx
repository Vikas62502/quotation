interface SolarLogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
  showText?: boolean
}

export function SolarLogo({ className = "", size = "md", showText = true }: SolarLogoProps) {
  const sizes = {
    sm: { icon: 120, text: "text-lg" },
    md: { icon: 150, text: "text-xl" },
    lg: { icon: 200, text: "text-3xl" },
  }

  const { icon, text } = sizes[size]

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Chairbord Solar Logo */}
      <img
        src="/chairbord-solar-logo.png"
        alt="Chairbord Solar Logo"
        width={icon}
        height={icon}
        className="flex-shrink-0 object-contain"
      />
  
    </div>
  )
}
