import { FiSearch, FiFilter, FiX, FiArrowUp, FiArrowDown } from "react-icons/fi";
import { SectionCard } from "@/components/ui/SectionCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface FiltersBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  sortOrder: "asc" | "desc";
  onSortChange: (order: "asc" | "desc") => void;
  artifactTypes: string[];
  className?: string;
}

export function FiltersBar({
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
  sortOrder,
  onSortChange,
  artifactTypes,
  className,
}: FiltersBarProps) {
  const hasActiveFilters = searchQuery || selectedType;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <SectionCard padding="sm" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FiFilter className="w-4 h-4" />
            Filters
          </h3>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onSearchChange("");
                onTypeChange("");
              }}
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">Search</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                type="text"
                placeholder="Filename or ID..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground font-medium">Type</label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant={!selectedType ? "default" : "outline"}
                className={cn(
                  "cursor-pointer hover:bg-primary/90 transition-colors",
                  !selectedType && "hover:bg-primary"
                )}
                onClick={() => onTypeChange("")}
              >
                All
              </Badge>
              {artifactTypes.map((type) => (
                <Badge
                  key={type}
                  variant={selectedType === type ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer hover:bg-primary/90 transition-colors",
                    selectedType === type && "hover:bg-primary"
                  )}
                  onClick={() => onTypeChange(type)}
                >
                  {type}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <label className="text-xs text-muted-foreground font-medium">Sort by Date</label>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
              <Button
                variant={sortOrder === "desc" ? "default" : "ghost"}
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => onSortChange("desc")}
              >
                <FiArrowDown className="w-3 h-3 mr-1.5" />
                Newest
              </Button>
              <Button
                variant={sortOrder === "asc" ? "default" : "ghost"}
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => onSortChange("asc")}
              >
                <FiArrowUp className="w-3 h-3 mr-1.5" />
                Oldest
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
