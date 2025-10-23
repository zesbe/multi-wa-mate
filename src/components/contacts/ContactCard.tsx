import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, User, Edit, Trash2, MessageSquare } from "lucide-react";

interface Contact {
  id: string;
  name: string | null;
  phone_number: string;
  is_group: boolean;
  group_members?: any[];
  created_at: string;
}

interface ContactCardProps {
  contact: Contact;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSendMessage?: () => void;
}

export function ContactCard({ 
  contact, 
  selected, 
  onSelect, 
  onEdit, 
  onDelete,
  onSendMessage 
}: ContactCardProps) {
  const memberCount = contact.group_members?.length || 0;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all hover:border-primary/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              className="flex-shrink-0"
            />
            <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center flex-shrink-0">
              {contact.is_group ? (
                <Users className="w-5 h-5 text-primary" />
              ) : (
                <User className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm truncate">
                {contact.name || contact.phone_number}
              </CardTitle>
              <CardDescription className="text-xs truncate">
                {contact.is_group ? (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {memberCount} anggota
                  </span>
                ) : (
                  contact.phone_number
                )}
              </CardDescription>
            </div>
          </div>
          {contact.is_group && (
            <Badge variant="secondary" className="text-xs flex-shrink-0">
              Grup
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {contact.is_group && contact.group_members && contact.group_members.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1 pb-2 border-b">
            <p className="font-medium">Anggota:</p>
            <div className="flex flex-wrap gap-1">
              {contact.group_members.slice(0, 3).map((member: any, idx: number) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {member.name}
                </Badge>
              ))}
              {contact.group_members.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{contact.group_members.length - 3} lainnya
                </Badge>
              )}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {onSendMessage && (
            <Button
              onClick={onSendMessage}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              Kirim
            </Button>
          )}
          <Button
            onClick={onEdit}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <Edit className="w-3 h-3 mr-1" />
            Edit
          </Button>
          <Button
            onClick={onDelete}
            variant="destructive"
            size="sm"
            className="text-xs col-span-2"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Hapus
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
