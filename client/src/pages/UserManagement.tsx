import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Home, UserPlus, Search, Edit, Trash2, KeyRound, Users } from "lucide-react";
import { toast } from "sonner";

export default function UserManagement() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "user" as "user" | "admin",
    canManageUsers: false,
  });
  const [newPassword, setNewPassword] = useState("");

  // Queries
  const { data: usersData, isLoading, refetch } = trpc.users.list.useQuery(
    { search: search || undefined },
    { retry: false, refetchOnWindowFocus: false }
  );

  // Mutations
  const createUser = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      setShowCreateModal(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar usuário");
    },
  });

  const updateUser = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("Usuário atualizado com sucesso!");
      setShowEditModal(false);
      setSelectedUser(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar usuário");
    },
  });

  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("Usuário excluído com sucesso!");
      setShowDeleteModal(false);
      setSelectedUser(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao excluir usuário");
    },
  });

  const resetPassword = trpc.users.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha resetada com sucesso! Email enviado ao usuário.");
      setShowResetPasswordModal(false);
      setSelectedUser(null);
      setNewPassword("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao resetar senha");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "user",
      canManageUsers: false,
    });
  };

  const handleCreate = () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    createUser.mutate({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role,
      permissions: formData.canManageUsers ? ["manage_users"] : [],
    });
  };

  const handleEdit = () => {
    if (!selectedUser) return;

    updateUser.mutate({
      id: selectedUser.id,
      name: formData.name,
      email: formData.email,
      role: formData.role,
      permissions: formData.canManageUsers ? ["manage_users"] : [],
    });
  };

  const handleDelete = () => {
    if (!selectedUser) return;
    deleteUser.mutate({ id: selectedUser.id });
  };

  const handleResetPassword = () => {
    if (!selectedUser || !newPassword) {
      toast.error("Digite a nova senha");
      return;
    }

    resetPassword.mutate({
      id: selectedUser.id,
      newPassword,
    });
  };

  const openEditModal = (user: any) => {
    setSelectedUser(user);
    const permissions = JSON.parse(user.permissions || "[]");
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role === "master" ? "admin" : user.role,
      canManageUsers: permissions.includes("manage_users"),
    });
    setShowEditModal(true);
  };

  const getRoleBadge = (role: string) => {
    if (role === "master") {
      return <Badge className="bg-purple-500">Master</Badge>;
    }
    if (role === "admin") {
      return <Badge className="bg-blue-500">Admin</Badge>;
    }
    return <Badge variant="secondary">Usuário</Badge>;
  };

  const getPermissionsBadges = (permissions: string) => {
    const perms = JSON.parse(permissions || "[]");
    if (perms.length === 0) return <span className="text-gray-400 text-sm">Nenhuma</span>;
    
    return (
      <div className="flex gap-1 flex-wrap">
        {perms.includes("manage_users") && (
          <Badge variant="outline" className="text-xs">Gerenciar Usuários</Badge>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/")}
            >
              <Home className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="h-8 w-8" />
                Gestão de Usuários
              </h1>
              <p className="text-gray-600 mt-1">
                Gerencie usuários e permissões do sistema
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Adicionar Usuário
          </Button>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Usuários Cadastrados</CardTitle>
            <CardDescription>
              Total: {usersData?.total || 0} usuários
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Carregando...</div>
            ) : usersData && usersData.users.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Permissões</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersData.users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{getPermissionsBadges(user.permissions)}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(user.lastSignedIn).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {user.role !== "master" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(user)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowResetPasswordModal(true);
                                }}
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowDeleteModal(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Nenhum usuário encontrado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create User Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo Usuário</DialogTitle>
              <DialogDescription>
                Preencha os dados do novo usuário. Um email será enviado com as credenciais.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="João Silva"
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="joao@empresa.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Senha *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="canManageUsers"
                  checked={formData.canManageUsers}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, canManageUsers: checked as boolean })
                  }
                />
                <Label htmlFor="canManageUsers" className="cursor-pointer">
                  Pode gerenciar usuários
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={createUser.isPending}>
                {createUser.isPending ? "Criando..." : "Criar Usuário"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Modal */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Atualize os dados do usuário.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-name">Nome Completo</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-canManageUsers"
                  checked={formData.canManageUsers}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, canManageUsers: checked as boolean })
                  }
                />
                <Label htmlFor="edit-canManageUsers" className="cursor-pointer">
                  Pode gerenciar usuários
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEdit} disabled={updateUser.isPending}>
                {updateUser.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Password Modal */}
        <Dialog open={showResetPasswordModal} onOpenChange={setShowResetPasswordModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resetar Senha</DialogTitle>
              <DialogDescription>
                Digite a nova senha para {selectedUser?.name}. Um email será enviado ao usuário.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResetPasswordModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleResetPassword} disabled={resetPassword.isPending}>
                {resetPassword.isPending ? "Resetando..." : "Resetar Senha"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Modal */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir Usuário</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir <strong>{selectedUser?.name}</strong>?
                Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteUser.isPending}
              >
                {deleteUser.isPending ? "Excluindo..." : "Excluir"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
