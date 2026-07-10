import { SparklesIcon } from "lucide-react"
import { useNavigate } from "react-router-dom"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useSettings } from "@/stores/settings"

export function SkillsSheet({
  open,
  onOpenChange,
  selected,
  onChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const skills = useSettings((s) => s.skills)
  const navigate = useNavigate()

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Skills</DrawerTitle>
          <DrawerDescription>
            Extra instructions the assistant follows in this chat.
          </DrawerDescription>
        </DrawerHeader>
        <div className="max-h-[50dvh] overflow-y-auto px-4 pb-safe">
          {skills.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <SparklesIcon className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No skills yet. Create reusable instructions the assistant can
                apply per chat.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false)
                  navigate("/settings#skills")
                }}
              >
                Create a skill
              </Button>
            </div>
          ) : (
            <div className="space-y-1 pb-6">
              {skills.map((sk) => (
                <label
                  key={sk.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 active:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium">{sk.name}</div>
                    {sk.description && (
                      <div className="truncate text-[12px] text-muted-foreground">
                        {sk.description}
                      </div>
                    )}
                  </div>
                  <Switch
                    checked={selected.includes(sk.id)}
                    onCheckedChange={(on) =>
                      onChange(
                        on
                          ? [...selected, sk.id]
                          : selected.filter((id) => id !== sk.id),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
