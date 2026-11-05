
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@repo/ui/dialog';
import { Input } from '@repo/ui/input';
import { Label } from '@repo/ui/label';
import { Textarea } from '@repo/ui/textarea';
import { Plus, Edit, Trash2, Link as LinkIcon, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/select';
import { Skeleton } from '@repo/ui/skeleton';
import { toast } from 'sonner';
import {
    useGetSuperDataQuery,
    useCreateSuperDataItemMutation,
    useUpdateSuperDataItemMutation,
    useDeleteSuperDataItemMutation,
    useGetCategoriesQuery,
    useCreateCategoryMutation,
    useUpdateCategoryMutation,
    useDeleteCategoryMutation,
    useGetServicesQuery,
    useCreateServiceMutation,
    useUpdateServiceMutation,
    useDeleteServiceMutation,
    useGetAdminProductCategoriesQuery,
    useCreateAdminProductCategoryMutation,
    useUpdateAdminProductCategoryMutation,
    useDeleteAdminProductCategoryMutation,
    useGetProductMastersQuery,
    useCreateProductMasterMutation,
    useUpdateProductMasterMutation,
    useDeleteProductMasterMutation,
} from '../../../../../packages/store/src/services/api';
import { Badge } from '@repo/ui/badge';
import { cn } from '@repo/ui/cn';

// Helper function to capitalize first letter and standardize input
const capitalizeFirstLetter = (str: string): string => {
    if (!str) return str;
    const trimmed = str.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

interface DropdownItem {
    _id: string;
    name: string;
    description?: string;
    type: string;
    parentId?: string;
    doctorType?: 'Physician' | 'Surgeon';
}

interface LocationItem extends DropdownItem {
    countryId?: string;
    stateId?: string;
}

interface ServiceCategory {
    _id: string;
    name: string;
    description?: string;
    categoryImage?: string;
}

interface Service {
    _id: string;
    name: string;
    description?: string;
    category: ServiceCategory | string;
    serviceImage?: string;
}

interface ProductCategory {
    _id: string;
    name: string;
    description?: string;
    gstType?: 'none' | 'fixed' | 'percentage';
    gstValue?: number;
    createdAt?: string;
    updatedAt?: string;
}

interface ProductMaster {
    _id: string;
    name: string;
    category: ProductCategory | string;
    brand?: string;
    description?: string;
    productForm?: string;
    keyIngredients?: string[];
    productImage?: string;
    productImages?: string[];
}

const DropdownManager = ({
    listTitle,
    listDescription,
    items,
    type,
    onUpdate,
    isLoading,
}: {
    listTitle: string;
    listDescription: string;
    items: DropdownItem[];
    type: string;
    onUpdate: (item: Partial<DropdownItem> & { newIndex?: number }, action: 'add' | 'edit' | 'delete' | 'move') => void;
    isLoading: boolean;
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<DropdownItem> | null>(null);

    const handleOpenModal = (item: Partial<DropdownItem> | null = null) => {
        setCurrentItem(item);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const name = (form.elements.namedItem('name') as HTMLInputElement).value;
        const descriptionInput = form.elements.namedItem('description');
        const linkInput = form.elements.namedItem('link');

        const description = descriptionInput ? (descriptionInput as HTMLTextAreaElement).value : undefined;
        const link = linkInput ? (linkInput as HTMLInputElement).value : undefined;

        const action = currentItem?._id ? 'edit' : 'add';
        const itemData: Partial<DropdownItem> = {
            _id: currentItem?._id,
            name,
            description: type === 'socialPlatform' ? link : description,
            type,
        };

        onUpdate(itemData, action);
        setIsModalOpen(false);
        setCurrentItem(null);
    };

    const handleDeleteClick = (item: DropdownItem) => {
        setCurrentItem(item);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (currentItem) {
            onUpdate({ _id: currentItem._id }, 'delete');
        }
        setIsDeleteModalOpen(false);
        setCurrentItem(null);
    };

    const handleMove = (index: number, direction: 'up' | 'down') => {
        const item = items[index];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= items.length) return;
        onUpdate({ ...item, newIndex }, 'move');
    }

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-64 mt-2" />
                        </div>
                        <Skeleton className="h-9 w-28" />
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 bg-secondary p-3 rounded-md">
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-8 w-24" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>{listTitle}</CardTitle>
                        <CardDescription>{listDescription}</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenModal()} disabled={isLoading}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add New
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {items.map((item: DropdownItem, index: number) => (
                        <div key={item._id} className="group flex items-center gap-2 bg-secondary/50 hover:bg-secondary p-2 rounded-md transition-colors">
                            <div className="flex-grow">
                                <p className="font-medium">{type === 'duration' ? `${item.name} minutes` : item.name}</p>
                                {type !== 'supplier' && type !== 'duration' && item.description && (
                                    <p className="text-sm text-muted-foreground">
                                        {type === 'socialPlatform' ? (
                                            <a href={item.description} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                                <LinkIcon className="h-3 w-3" />
                                                {item.description}
                                            </a>
                                        ) : item.description}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" onClick={() => handleMove(index, 'up')} disabled={index === 0}>
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleMove(index, 'down')} disabled={index === items.length - 1}>
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleOpenModal(item)} disabled={isLoading}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteClick(item)} disabled={isLoading}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {items.length === 0 && !isLoading && (
                        <div className="text-center py-8 text-muted-foreground">
                            No items found.
                        </div>
                    )}
                </div>

                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent 
                        className="sm:max-w-lg"
                        onPointerDownOutside={(e) => e.preventDefault()}
                        onInteractOutside={(e) => e.preventDefault()}
                    >
                        <form onSubmit={handleSave}>
                            <DialogHeader>
                                <DialogTitle>{currentItem?._id ? 'Edit' : 'Add'} Item</DialogTitle>
                                <DialogDescription>
                                    {currentItem?._id ? `Editing "${(currentItem as DropdownItem).name}".` : `Add a new item to "${listTitle}".`}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">{type === 'duration' ? 'Duration (minutes)' : 'Name'}</Label>
                                    {type === 'duration' ? (
                                        <Input
                                            id="name"
                                            name="name"
                                            type="number"
                                            min="1"
                                            step="1"
                                            defaultValue={currentItem?.name || ''}
                                            placeholder="e.g., 15, 30, 45, 60"
                                            required
                                        />
                                    ) : (
                                        <Input id="name" name="name" defaultValue={currentItem?.name || ''} required />
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {type === 'socialPlatform' ? (
                                        <>
                                            <Label htmlFor="link">Profile Link</Label>
                                            <Input id="link" name="link" type="url" defaultValue={currentItem?.description || ''} placeholder="https://example.com/profile" />
                                        </>
                                    ) : type !== 'duration' && (
                                        <>
                                            <Label htmlFor="description">Description</Label>
                                            <Textarea id="description" name="description" defaultValue={currentItem?.description || ''} />
                                        </>
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                                <Button type="submit">Save</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                    <DialogContent
                        onPointerDownOutside={(e) => e.preventDefault()}
                        onInteractOutside={(e) => e.preventDefault()}
                    >
                        <DialogHeader>
                            <DialogTitle>Delete Item?</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete "{(currentItem as DropdownItem)?.name}"? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleConfirmDelete}>Delete</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
};

const ServiceCategoryManager = () => {
    const { data: categoriesRaw = [], isLoading, isError } = useGetCategoriesQuery(undefined);
    const categories = useMemo(() => [...categoriesRaw].reverse(), [categoriesRaw]);
    const [createCategory] = useCreateCategoryMutation();
    const [updateCategory] = useUpdateCategoryMutation();
    const [deleteCategory] = useDeleteCategoryMutation();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<ServiceCategory> | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);

    const handleOpenModal = (item: Partial<ServiceCategory> | null = null) => {
        setCurrentItem(item);
        setImageBase64(item?.categoryImage || null);
        setIsModalOpen(true);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageBase64(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setImageBase64(null);
        }
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const name = (form.elements.namedItem('name') as HTMLInputElement).value;
        const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value;

        const action = currentItem?._id ? 'edit' : 'add';
        const itemData = {
            id: currentItem?._id,
            name,
            description,
            image: imageBase64,
        };

        try {
            if (action === 'add') {
                await createCategory(itemData).unwrap();
            } else {
                await updateCategory(itemData).unwrap();
            }
            toast.success('Success', { description: `Category ${action}ed successfully.` });
            setIsModalOpen(false);
            setCurrentItem(null);
            setImageBase64(null);
        } catch (error: any) {
            console.error(`Failed to ${action} category:`, error);
        }
    };

    const handleDeleteClick = (item: ServiceCategory) => {
        setCurrentItem(item);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (currentItem?._id) {
            try {
                await deleteCategory({ id: currentItem._id }).unwrap();
                toast.success('Success', { description: 'Category deleted successfully.' });
                setIsDeleteModalOpen(false);
                setCurrentItem(null);
            } catch (error: any) {
                console.error('Failed to delete category:', error);
            }
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <Skeleton className="h-6 w-40" />
                            <Skeleton className="h-4 w-56 mt-2" />
                        </div>
                        <Skeleton className="h-9 w-32" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto no-scrollbar rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                                    <TableHead className="text-right"><Skeleton className="h-4 w-16" /></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                                        <TableCell className="text-right">
                                            <Skeleton className="h-8 w-8 inline-block mr-2" />
                                            <Skeleton className="h-8 w-8 inline-block" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Service Categories</CardTitle>
                        <CardDescription>Manage categories for salon services.</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenModal()} disabled={isLoading}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Category
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto no-scrollbar rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Image</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.map((item: ServiceCategory) => (
                                <TableRow key={item._id}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{item.description}</TableCell>
                                    <TableCell>
                                        {item.categoryImage ? (
                                            <img src={item.categoryImage} alt={item.name} className="h-12 w-12 object-cover rounded" />
                                        ) : (
                                            <span className="text-muted-foreground">No image</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenModal(item)} disabled={isLoading}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteClick(item)} disabled={isLoading}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {categories.length === 0 && !isLoading && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                                        No categories found.
                                    </TableCell>
                                </TableRow>
                            )}
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent 
                        className="sm:max-w-lg"
                        onPointerDownOutside={(e) => e.preventDefault()}
                        onInteractOutside={(e) => e.preventDefault()}
                    >
                        <form onSubmit={handleSave}>
                            <DialogHeader>
                                <DialogTitle>{currentItem?._id ? 'Edit' : 'Add'} Category</DialogTitle>
                                <DialogDescription>
                                    {currentItem?._id ? `Editing "${currentItem.name}".` : 'Add a new service category.'}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input id="name" name="name" defaultValue={currentItem?.name || ''} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea id="description" name="description" defaultValue={currentItem?.description || ''} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="image">Image</Label>
                                    <Input
                                        id="image"
                                        name="image"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                    />
                                    {imageBase64 && (
                                        <img src={imageBase64} alt="Preview" className="mt-2 h-24 w-24 object-cover rounded" />
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                                <Button type="submit">Save</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                    <DialogContent
                        onPointerDownOutside={(e) => e.preventDefault()}
                        onInteractOutside={(e) => e.preventDefault()}
                    >
                        <DialogHeader>
                            <DialogTitle>Delete Category?</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete "{currentItem?.name}"? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleConfirmDelete}>Delete</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
};

const ServiceManager = () => {
    const { data: servicesRaw = [], isLoading, isError } = useGetServicesQuery(undefined);
    const services = useMemo(() => [...servicesRaw].reverse(), [servicesRaw]);
    const { data: categories = [] } = useGetCategoriesQuery(undefined);
    const [createService] = useCreateServiceMutation();
    const [updateService] = useUpdateServiceMutation();
    const [deleteService] = useDeleteServiceMutation();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<Service> | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);

    const handleOpenModal = (item: Partial<Service> | null = null) => {
        setCurrentItem(item);
        setImageBase64(item?.serviceImage || null);
        setIsModalOpen(true);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageBase64(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setImageBase64(null);
        }
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const name = (form.elements.namedItem('name') as HTMLInputElement).value;
        const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value;
        const category = (form.elements.namedItem('category') as HTMLSelectElement).value;

        const action = currentItem?._id ? 'edit' : 'add';
        const itemData = {
            id: currentItem?._id,
            name,
            description,
            category,
            image: imageBase64,
        };

        try {
            if (action === 'add') {
                await createService(itemData).unwrap();
            } else {
                await updateService(itemData).unwrap();
            }
            toast.success('Success', { description: `Service ${action}ed successfully.` });
            setIsModalOpen(false);
            setCurrentItem(null);
            setImageBase64(null);
        } catch (error: any) {
            console.error(`Failed to ${action} service:`, error);
        }
    };

    const handleDeleteClick = (item: Service) => {
        setCurrentItem(item);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (currentItem?._id) {
            try {
                await deleteService({ id: currentItem._id }).unwrap();
                toast.success('Success', { description: 'Service deleted successfully.' });
                setIsDeleteModalOpen(false);
                setCurrentItem(null);
            } catch (error: any) {
                console.error('Failed to delete service:', error);
            }
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-4 w-52 mt-2" />
                        </div>
                        <Skeleton className="h-9 w-32" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto no-scrollbar rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                                    <TableHead className="text-right"><Skeleton className="h-4 w-16" /></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                                        <TableCell className="text-right">
                                            <Skeleton className="h-8 w-8 inline-block mr-2" />
                                            <Skeleton className="h-8 w-8 inline-block" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Services</CardTitle>
                        <CardDescription>Manage individual salon services.</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenModal()} disabled={isLoading || categories.length === 0}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Service
                    </Button>
                </div>
                {categories.length === 0 && <p className="text-sm text-yellow-600 mt-2">Please add a category first before adding services.</p>}
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto no-scrollbar rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Image</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {services.map((item: Service) => (
                                <TableRow key={item._id}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                   <TableCell>
    <Badge variant="secondary">
        {item.category &&
        typeof item.category === "object"
            ? item.category.name
            : "N/A"}
    </Badge>
</TableCell>
                                    <TableCell className="text-muted-foreground">{item.description}</TableCell>
                                    <TableCell>
                                        {item.serviceImage ? (
                                            <img src={item.serviceImage} alt={item.name} className="h-12 w-12 object-cover rounded" />
                                        ) : (
                                            <span className="text-muted-foreground">No image</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenModal(item)} disabled={isLoading}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteClick(item)} disabled={isLoading}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {services.length === 0 && !isLoading && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                                        No services found.
                                    </TableCell>
                                </TableRow>
                            )}
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent 
                        className="sm:max-w-lg"
                        onPointerDownOutside={(e) => e.preventDefault()}
                        onInteractOutside={(e) => e.preventDefault()}
                    >
                        <form onSubmit={handleSave}>
                            <DialogHeader>
                                <DialogTitle>{currentItem?._id ? 'Edit' : 'Add'} Service</DialogTitle>
                                <DialogDescription>
                                    {currentItem?._id ? `Editing "${(currentItem as Service).name}".` : 'Add a new service.'}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input id="name" name="name" defaultValue={currentItem?.name || ''} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Select name="category" defaultValue={typeof currentItem?.category === 'object' ? (currentItem?.category as ServiceCategory)?._id : currentItem?.category as string} required>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map((cat: ServiceCategory) => (
                                                <SelectItem key={cat._id} value={cat._id}>{cat.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea id="description" name="description" defaultValue={currentItem?.description || ''} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="image">Image</Label>
                                    <Input
                                        id="image"
                                        name="image"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                    />
                                    {imageBase64 && (
                                        <img src={imageBase64} alt="Preview" className="mt-2 h-24 w-24 object-cover rounded" />
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                                <Button type="submit">Save</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                    <DialogContent
                        onPointerDownOutside={(e) => e.preventDefault()}
                        onInteractOutside={(e) => e.preventDefault()}
                    >
                        <DialogHeader>
                            <DialogTitle>Delete Service?</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete "{(currentItem as Service)?.name}"? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleConfirmDelete}>Delete</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
};

const ProductMasterManager = () => {
    const { data: productMastersRaw = [], isLoading, isError } = useGetProductMastersQuery(undefined);
    const productMasters = useMemo(() => {
        return [...productMastersRaw].reverse();
    }, [productMastersRaw]);
    const { data: productCategoriesResponse } = useGetAdminProductCategoriesQuery(undefined);
    const [createProductMaster] = useCreateProductMasterMutation();
    const [updateProductMaster] = useUpdateProductMasterMutation();
    const [deleteProductMaster] = useDeleteProductMasterMutation();

    const productCategories = useMemo(() => {
        if (productCategoriesResponse && Array.isArray(productCategoriesResponse.data)) {
            return productCategoriesResponse.data;
        }
        return [];
    }, [productCategoriesResponse]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<ProductMaster> | null>(null);
    const [images, setImages] = useState<string[]>([]);

    const handleOpenModal = (item: Partial<ProductMaster> | null = null) => {
        setCurrentItem(item);
        const existingImages = item?.productImages || (item?.productImage ? [item.productImage] : []);
        setImages(existingImages);
        setIsModalOpen(true);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setImages(prev => [...prev, reader.result as string]);
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const name = capitalizeFirstLetter((form.elements.namedItem('name') as HTMLInputElement).value);
        const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value.trim();
        const category = (form.elements.namedItem('category') as HTMLSelectElement).value;
        const brand = capitalizeFirstLetter((form.elements.namedItem('brand') as HTMLInputElement).value);
        const productForm = capitalizeFirstLetter((form.elements.namedItem('productForm') as HTMLInputElement).value);
        const keyIngredientsInput = (form.elements.namedItem('keyIngredients') as HTMLInputElement).value;

        // Parse key ingredients - comma separated, capitalize each ingredient
        const keyIngredients = keyIngredientsInput
            .split(',')
            .map(ing => capitalizeFirstLetter(ing))
            .filter(ing => ing.length > 0);

        const action = currentItem?._id ? 'edit' : 'add';
        const itemData = {
            id: currentItem?._id,
            name,
            description,
            category,
            brand,
            productForm,
            keyIngredients,
            image: images, // This is now an array
        };

        try {
            if (action === 'add') {
                await createProductMaster(itemData).unwrap();
            } else {
                await updateProductMaster(itemData).unwrap();
            }
            toast.success('Success', { description: `Product master ${action}ed successfully.` });
            setIsModalOpen(false);
            setCurrentItem(null);
            setImages([]);
        } catch (error: any) {
            console.error(`Failed to ${action} product master:`, error);
        }
    };

    const handleDeleteClick = (item: ProductMaster) => {
        setCurrentItem(item);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (currentItem?._id) {
            try {
                await deleteProductMaster({ id: currentItem._id }).unwrap();
                toast.success('Success', { description: 'Product master deleted successfully.' });
                setIsDeleteModalOpen(false);
                setCurrentItem(null);
            } catch (error: any) {
                console.error('Failed to delete product master:', error);
            }
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-4 w-52 mt-2" />
                        </div>
                        <Skeleton className="h-9 w-32" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto no-scrollbar rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                    <TableHead className="text-right"><Skeleton className="h-4 w-16" /></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                                        <TableCell className="text-right">
                                            <Skeleton className="h-8 w-8 inline-block mr-2" />
                                            <Skeleton className="h-8 w-8 inline-block" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Product Masters</CardTitle>
                        <CardDescription>Manage master product templates for vendors to use.</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenModal()} disabled={isLoading || productCategories.length === 0}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Product Master
                    </Button>
                </div>
                {productCategories.length === 0 && <p className="text-sm text-yellow-600 mt-2">Please add a product category first before adding product masters.</p>}
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto no-scrollbar rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Brand</TableHead>
                                <TableHead>Product Form</TableHead>
                                <TableHead>Image</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {productMasters.map((item: ProductMaster) => (
                                <TableRow key={item._id}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">
                                            {typeof item.category === 'object' && item.category !== null ? (item.category as ProductCategory).name : 'N/A'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{item.brand || '-'}</TableCell>
                                    <TableCell className="text-muted-foreground">{item.productForm || '-'}</TableCell>
                                    <TableCell>
                                        <img
                                            src={item.productImage || "/images/product-placeholder.png"}
                                            alt={item.name}
                                            className="h-12 w-12 object-cover rounded"
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenModal(item)} disabled={isLoading}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteClick(item)} disabled={isLoading}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {productMasters.length === 0 && !isLoading && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                                        No product masters found.
                                    </TableCell>
                                </TableRow>
                            )}
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent 
                        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
                        onPointerDownOutside={(e) => e.preventDefault()}
                        onInteractOutside={(e) => e.preventDefault()}
                    >
                        <form onSubmit={handleSave}>
                            <DialogHeader>
                                <DialogTitle>{currentItem?._id ? 'Edit' : 'Add'} Product Master</DialogTitle>
                                <DialogDescription>
                                    {currentItem?._id ? `Editing "${(currentItem as ProductMaster).name}".` : 'Add a new product master template.'}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Name *</Label>
                                        <Input id="name" name="name" defaultValue={currentItem?.name || ''} required placeholder="e.g., Vitamin C Serum" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="category">Category *</Label>
                                        <Select name="category" defaultValue={typeof currentItem?.category === 'object' ? (currentItem?.category as ProductCategory)?._id : currentItem?.category as string} required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {productCategories.map((cat: ProductCategory) => (
                                                    <SelectItem key={cat._id} value={cat._id}>{cat.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="brand">Brand</Label>
                                        <Input id="brand" name="brand" defaultValue={currentItem?.brand || ''} placeholder="e.g., Neutrogena" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="productForm">Product Form</Label>
                                        <Input id="productForm" name="productForm" defaultValue={currentItem?.productForm || ''} placeholder="e.g., serum, cream, oil" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea id="description" name="description" defaultValue={currentItem?.description || ''} placeholder="Enter product description..." rows={3} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="keyIngredients">Key Ingredients</Label>
                                    <Input
                                        id="keyIngredients"
                                        name="keyIngredients"
                                        defaultValue={Array.isArray(currentItem?.keyIngredients) ? currentItem.keyIngredients.join(', ') : ''}
                                        placeholder="e.g., Vitamin C, Hyaluronic Acid, Retinol (comma separated)"
                                    />
                                    <p className="text-xs text-muted-foreground">Separate multiple ingredients with commas</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="image">Product Images</Label>
                                    <Input
                                        id="image"
                                        name="image"
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageChange}
                                    />
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {images.map((img, index) => (
                                            <div key={index} className="relative group">
                                                <img src={img} alt={`Preview ${index}`} className="h-20 w-20 object-cover rounded border" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(index)}
                                                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">First image will be the primary image shown in lists. You can upload multiple.</p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                                <Button type="submit">Save</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                    <DialogContent
                        onPointerDownOutside={(e) => e.preventDefault()}
                        onInteractOutside={(e) => e.preventDefault()}
                    >
                        <DialogHeader>
                            <DialogTitle>Delete Product Master?</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete "{(currentItem as ProductMaster)?.name}"? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleConfirmDelete}>Delete</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
};

const HierarchicalManager = ({ title, description, data, onUpdate, isLoading }: { title: string; description: string; data: DropdownItem[]; onUpdate: (item: Partial<DropdownItem> & { newIndex?: number }, action: 'add' | 'edit' | 'delete' | 'move') => void; isLoading: boolean; }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<Partial<DropdownItem> | null>(null);
    const [modalConfig, setModalConfig] = useState<{ type: string; parentId?: string; parentName?: string; action: 'add' | 'edit' }>({ type: 'specialization', action: 'add' });
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

    const [selectedDoctorType, setSelectedDoctorType] = useState<'Physician' | 'Surgeon'>();

    const specializations = useMemo(() => [...data.filter(item => item.type === 'specialization')].reverse(), [data]);

    const getChildren = (parentId: string) => {
        return [...data.filter(item => item.type === 'disease' && item.parentId === parentId)].reverse();
    }

    const handleOpenModal = (action: 'add' | 'edit', type: string, item?: Partial<DropdownItem>, parentId?: string, parentName?: string) => {
        setCurrentItem(item || null);
        if (type === 'specialization' && item?.doctorType) {
            setSelectedDoctorType(item.doctorType);
        } else {
            setSelectedDoctorType(undefined);
        }
        setModalConfig({ type, parentId, parentName, action });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;

        const name = (form.elements.namedItem('name') as HTMLInputElement).value;
        const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value;

        if (modalConfig.type === 'specialization' && !selectedDoctorType) {
            toast.error("Doctor Type is required for a specialization.");
            return;
        }

        const itemData: Partial<DropdownItem> = {
            _id: currentItem?._id,
            name,
            description,
            type: modalConfig.type,
            parentId: modalConfig.parentId,
            // Include doctorType only for specializations
            doctorType: modalConfig.type === 'specialization' && selectedDoctorType && (selectedDoctorType === 'Physician' || selectedDoctorType === 'Surgeon') ? selectedDoctorType : undefined,
        };

        await onUpdate(itemData, modalConfig.action);
        setIsModalOpen(false);
        setCurrentItem(null);
    };

    const handleDeleteClick = (item: DropdownItem) => {
        setCurrentItem(item);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (currentItem?._id) {
            onUpdate({ _id: currentItem._id }, 'delete');
        }
        setIsDeleteModalOpen(false);
        setCurrentItem(null);
    };

    const toggleExpand = (id: string) => {
        setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleMove = (items: DropdownItem[], index: number, direction: 'up' | 'down') => {
        const item = items[index];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= items.length) return;
        onUpdate({ ...item, newIndex }, 'move');
    };

    const renderItem = (item: DropdownItem, index: number, siblings: DropdownItem[], level: number) => {
        const children = getChildren(item._id);
        const isExpanded = expandedItems[item._id];

        const isFirst = index === 0;
        const isLast = index === siblings.length - 1;

        return (
            <div key={item._id} className={level === 0 ? "border-t" : "border-t border-dashed"}>
                <div className="flex items-center gap-2 py-2 pr-2" style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}>
                    {item.type === 'specialization' && (
                        <button onClick={() => toggleExpand(item._id)} className="p-1 hover:bg-secondary rounded-full">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                    )}
                    <span className="flex-grow font-medium">{item.name} {item.doctorType && <Badge variant="outline">{item.doctorType}</Badge>}</span>

                    {/* Move buttons */}
                    <div className="flex items-center gap-1 mr-2 border-r pr-2 shadow-sm">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={isFirst}
                            onClick={() => handleMove(siblings, index, 'up')}
                        >
                            <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={isLast}
                            onClick={() => handleMove(siblings, index, 'down')}
                        >
                            <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    {item.type === 'specialization' && (
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => handleOpenModal('add', 'disease', undefined, item._id, item.name)}>
                            <Plus className="mr-1 h-3 w-3" /> Add Disease
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenModal('edit', item.type, item, item.parentId)}>
                        <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteClick(item)}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
                {isExpanded && item.type === 'specialization' && (
                    <div className="ml-4 pl-2">
                        {children.length > 0 ? children.map((child, idx) => renderItem(child, idx, children, level + 1)) : <div className="pl-8 text-sm text-muted-foreground py-1">No diseases added yet.</div>}
                    </div>
                )}
            </div>
        );
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-64 mt-2" />
                        </div>
                        <Skeleton className="h-9 w-40" />
                    </div>
                </CardHeader>
                <CardContent className="border rounded-md">
                    <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="border-t first:border-t-0">
                                <div className="flex items-center justify-between py-3 px-4">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="h-4 w-4" />
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-5 w-16 rounded-full" />
                                    </div>
                                    <div className="flex gap-1">
                                        <Skeleton className="h-7 w-24" />
                                        <Skeleton className="h-7 w-7" />
                                        <Skeleton className="h-7 w-7" />
                                    </div>
                                </div>
                                <div className="ml-4 pl-2 space-y-1">
                                    {[...Array(2)].map((_, j) => (
                                        <div key={j} className="border-t border-dashed">
                                            <div className="flex items-center justify-between py-2 px-4 pl-8">
                                                <Skeleton className="h-4 w-28" />
                                                <div className="flex gap-1">
                                                    <Skeleton className="h-7 w-7" />
                                                    <Skeleton className="h-7 w-7" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenModal('add', 'specialization')}>
                        <Plus className="mr-2 h-4 w-4" /> Add Specialization
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="border rounded-md">
                {isLoading ? <div className="text-center p-4">Loading...</div> :
                    specializations.length === 0 ? <div className="text-center p-8 text-muted-foreground">No specializations found.</div> :
                        specializations.map((item, idx) => renderItem(item, idx, specializations, 0))}
            </CardContent>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent 
                    className="sm:max-w-md"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <form onSubmit={handleSave}>
                        <DialogHeader>
                            <DialogTitle>
                                {modalConfig.action === 'add' ? 'Add New' : 'Edit'} {modalConfig.type.replace(/([A-Z])/g, ' $1').trim()}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            {modalConfig.type === 'specialization' && (
                                <div className="space-y-2">
                                    <Label htmlFor="doctorType">Doctor Type *</Label>
                                    <Select
                                        value={selectedDoctorType}
                                        onValueChange={(value) => setSelectedDoctorType(value as 'Physician' | 'Surgeon')}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a Doctor Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Physician">Physician</SelectItem>
                                            <SelectItem value="Surgeon">Surgeon</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            {modalConfig.type === 'disease' && modalConfig.parentId && (
                                <div className="space-y-2">
                                    <Label>Parent Specialization</Label>
                                    <Input value={modalConfig.parentName} readOnly disabled />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="name">{modalConfig.type.replace(/([A-Z])/g, ' $1').trim()} Name</Label>
                                <Input id="name" name="name" defaultValue={currentItem?.name || ''} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea id="description" name="description" defaultValue={currentItem?.description || ''} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <DialogContent
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>Delete Item?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{(currentItem as DropdownItem)?.name}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleConfirmDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};

export default function DropdownManagementPage() {
    const { data = [], isLoading, isError } = useGetSuperDataQuery(undefined);
    const [createItem] = useCreateSuperDataItemMutation();
    const [updateItem] = useUpdateSuperDataItemMutation();
    const [deleteItem] = useDeleteSuperDataItemMutation();

    const handleUpdate = async (item: Partial<DropdownItem> & { newIndex?: number }, action: 'add' | 'edit' | 'delete' | 'move') => {
        try {
            if (action === 'add') {
                await createItem(item).unwrap();
                toast.success('Success', { description: 'Item added successfully.' });
            } else if (action === 'edit' && item._id) {
                await updateItem({ id: item._id, ...item }).unwrap();
                toast.success('Success', { description: 'Item updated successfully.' });
            } else if (action === 'delete' && item._id) {
                await deleteItem({ id: item._id }).unwrap();
                toast.success('Success', { description: 'Item deleted successfully.' });
            } else if (action === 'move' && item._id) {
                await updateItem({ id: item._id, action: 'move', newIndex: item.newIndex }).unwrap();
                toast.success('Success', { description: 'Item reordered successfully.' });
            }
        } catch (error: any) {
            const errorMessage = error?.data?.message || `Failed to ${action} item.`;
            toast.error('Error', { description: errorMessage });
            console.error(`API call failed for ${action}:`, error);
        }
    };

    if (isError) {
        return <div className="p-8 text-center text-destructive">Error fetching data. Please try again.</div>;
    }

    if (isLoading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8">
                <Skeleton className="h-8 w-32 mb-6" />
                <div className="w-full">
                    {/* Tabs skeleton */}
                    <div className="grid w-full grid-cols-2 md:grid-cols-7 max-w-5xl mb-6">
                        {[...Array(7)].map((_, i) => (
                            <Skeleton key={i} className="h-9 w-full" />
                        ))}
                    </div>

                    {/* Tab content skeleton */}
                    <div className="space-y-6">
                        {[...Array(3)].map((_, i) => (
                            <Card key={i}>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <Skeleton className="h-6 w-40" />
                                            <Skeleton className="h-4 w-64 mt-2" />
                                        </div>
                                        <Skeleton className="h-9 w-28" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto no-scrollbar rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                                                    <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                                    <TableHead className="text-right"><Skeleton className="h-4 w-16" /></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {[...Array(5)].map((_, j) => (
                                                    <TableRow key={j}>
                                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                                        <TableCell className="text-right">
                                                            <Skeleton className="h-8 w-8 inline-block mr-2" />
                                                            <Skeleton className="h-8 w-8 inline-block" />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const dropdownTypes = [
        { key: 'faqCategory', title: 'FAQ Categories', description: 'Manage categories for organizing FAQs.', tab: 'general' },
        { key: 'bank', title: 'Bank Names', description: 'Manage a list of supported banks.', tab: 'general' },
        { key: 'documentType', title: 'Document Types', description: 'Manage types of documents required for verification.', tab: 'general' },
        { key: 'expenseType', title: 'Expense Types', description: 'Manage types of expenses for tracking and reporting.', tab: 'general' },
        { key: 'paymentMode', title: 'Payment Modes', description: 'Manage payment methods for transactions.', tab: 'general' },
        { key: 'duration', title: 'Duration Values', description: 'Manage predefined duration values (in minutes) for services.', tab: 'general' },
        { key: 'designation', title: 'Admin Designations', description: 'Manage the list of available staff designations.', tab: 'general' },
        { key: 'smsType', title: 'SMS Template Types', description: 'Manage types for SMS templates.', tab: 'marketing' },
        { key: 'socialPlatform', title: 'Social Media Platforms', description: 'Manage platforms for social posts.', tab: 'marketing' },
        { key: 'socialMediaTemplateType', title: 'Social Media Template Types', description: 'Manage categories for social media templates.', tab: 'marketing' },
        { key: 'supplier', title: 'Supplier Types', description: 'Manage types of suppliers.', tab: 'suppliers' }, // Changed from 'supplierType' to 'supplier'
    ];

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <h1 className="text-2xl font-bold font-headline mb-6">Superdata</h1>
            <Tabs defaultValue="general" className="w-full">
                <TabsList className="flex w-full justify-start overflow-x-auto no-scrollbar mb-6 bg-transparent border-b rounded-none h-auto p-0 gap-6">
                    <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 pb-2">General</TabsTrigger>
                    <TabsTrigger value="services" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 pb-2">Services</TabsTrigger>
                    <TabsTrigger value="doctors" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 pb-2">Doctors</TabsTrigger>
                    <TabsTrigger value="marketing" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 pb-2">Marketing</TabsTrigger>
                    <TabsTrigger value="products" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 pb-2">Products</TabsTrigger>
                    <TabsTrigger value="suppliers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-2 pb-2">Suppliers</TabsTrigger>
                </TabsList>
                <TabsContent value="general">
                    <div className="space-y-8">
                        {dropdownTypes.filter(d => d.tab === 'general').map(d => (
                            <DropdownManager
                                key={d.key}
                                listTitle={d.title}
                                listDescription={d.description}
                                items={[...data.filter((item: DropdownItem) => item.type === d.key)].reverse()}
                                type={d.key}
                                onUpdate={handleUpdate}
                                isLoading={isLoading}
                            />
                        ))}
                    </div>
                </TabsContent>
                <TabsContent value="services">
                    <div className="space-y-8">
                        <ServiceCategoryManager />
                        <ServiceManager />
                    </div>
                </TabsContent>

                <TabsContent value="doctors">
                    <div className="space-y-8">
                        <HierarchicalManager
                            title="Doctor Specialization Management"
                            description="Manage doctor types, their specializations, and associated diseases."
                            data={data}
                            onUpdate={handleUpdate}
                            isLoading={isLoading}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="marketing">
                    <div className="space-y-8">
                        {dropdownTypes.filter(d => d.tab === 'marketing').map(d => (
                            <DropdownManager
                                key={d.key}
                                listTitle={d.title}
                                listDescription={d.description}
                                items={[...data.filter((item: DropdownItem) => item.type === d.key)].reverse()}
                                type={d.key}
                                onUpdate={handleUpdate}
                                isLoading={isLoading}
                            />
                        ))}
                    </div>
                </TabsContent>
                <TabsContent value="products">
                    <div className="space-y-8">
                        <ProductCategoryManager />
                        <ProductMasterManager />
                    </div>
                </TabsContent>
                <TabsContent value="suppliers">
                    <div className="space-y-8">
                        {dropdownTypes.filter((d: any) => d.tab === 'suppliers').map((d: any) => (
                            <DropdownManager
                                key={d.key}
                                listTitle={d.title}
                                listDescription={d.description}
                                items={[...data.filter((item: DropdownItem) => item.type === d.key)].reverse()}
                                type={d.key}
                                onUpdate={handleUpdate}
                                isLoading={isLoading}
                            />
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

const ProductCategoryManager = () => {
    const { data: productCategoriesResponse, isLoading, refetch } = useGetAdminProductCategoriesQuery(undefined);
    const [createCategory] = useCreateAdminProductCategoryMutation();
    const [updateCategory] = useUpdateAdminProductCategoryMutation();
    const [deleteCategory] = useDeleteAdminProductCategoryMutation();

    const productCategories = useMemo(() => {
        if (productCategoriesResponse && Array.isArray(productCategoriesResponse.data)) {
            return productCategoriesResponse.data;
        }
        return [];
    }, [productCategoriesResponse]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [currentCategory, setCurrentCategory] = useState<ProductCategory | null>(null);
    const [formData, setFormData] = useState({ name: '', description: '', gstType: 'none', gstValue: 0 });

    const handleOpenModal = (category: ProductCategory | null = null) => {
        if (category) {
            setCurrentCategory(category);
            setFormData({
                name: category.name,
                description: category.description || '',
                gstType: category.gstType || 'none',
                gstValue: category.gstValue || 0
            });
        } else {
            setCurrentCategory(null);
            setFormData({ name: '', description: '', gstType: 'none', gstValue: 0 });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error('Category name is required');
            return;
        }

        try {
            if (currentCategory) {
                await updateCategory({
                    id: currentCategory._id,
                    name: capitalizeFirstLetter(formData.name),
                    description: formData.description.trim(),
                    gstType: formData.gstType,
                    gstValue: Number(formData.gstValue)
                }).unwrap();
                toast.success('Category updated successfully');
            } else {
                await createCategory({
                    name: capitalizeFirstLetter(formData.name),
                    description: formData.description.trim(),
                    gstType: formData.gstType,
                    gstValue: Number(formData.gstValue)
                }).unwrap();
                toast.success('Category created successfully');
            }

            setIsModalOpen(false);
            setFormData({ name: '', description: '', gstType: 'none', gstValue: 0 });
            setCurrentCategory(null);
            refetch();
        } catch (error: any) {
            console.error('Failed to save category:', error);
        }
    };

    const handleDeleteClick = (category: ProductCategory) => {
        setCurrentCategory(category);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!currentCategory) return;

        try {
            await deleteCategory({ id: currentCategory._id }).unwrap();
            toast.success('Category deleted successfully');
            setIsDeleteModalOpen(false);
            setCurrentCategory(null);
            refetch();
        } catch (error: any) {
            console.error('Error deleting category:', error);
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <Skeleton className="h-6 w-40" />
                            <Skeleton className="h-4 w-56 mt-2" />
                        </div>
                        <Skeleton className="h-9 w-32" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto no-scrollbar rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                                    <TableHead className="text-right"><Skeleton className="h-4 w-16" /></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell className="text-right">
                                            <Skeleton className="h-8 w-8 inline-block mr-2" />
                                            <Skeleton className="h-8 w-8 inline-block" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Product Categories</CardTitle>
                        <CardDescription>Manage product categories for your catalog</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenModal()} disabled={isLoading}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Category
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto no-scrollbar rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>GST</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-8">
                                        Loading categories...
                                    </TableCell>
                                </TableRow>
                            ) : productCategories.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        No categories found. Create your first category.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                productCategories.map((category: ProductCategory) => (
                                    <TableRow key={category._id}>
                                        <TableCell className="font-medium">{category.name}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {category.description || 'No description'}
                                        </TableCell>
                                        <TableCell>
                                            {category.gstType === 'none' ? (
                                                <Badge variant="secondary">No GST</Badge>
                                            ) : category.gstType === 'fixed' ? (
                                                <Badge variant="default">₹{category.gstValue} Fixed</Badge>
                                            ) : (
                                                <Badge variant="default">{category.gstValue}%</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleOpenModal(category)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteClick(category)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {/* Add/Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent 
                    className="sm:max-w-md"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <form onSubmit={handleSave}>
                        <DialogHeader>
                            <DialogTitle>
                                {currentCategory ? 'Edit Category' : 'Add New Category'}
                            </DialogTitle>
                            <DialogDescription>
                                {currentCategory ? 'Update the category details below.' : 'Create a new product category.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Category Name *</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Enter category name"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Enter category description"
                                    rows={3}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gstType">GST Type</Label>
                                <Select
                                    value={formData.gstType}
                                    onValueChange={(value) => setFormData({ ...formData, gstType: value as 'none' | 'fixed' | 'percentage' })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select GST type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No GST</SelectItem>
                                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                                        <SelectItem value="percentage">Percentage</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.gstType !== 'none' && (
                                <div className="space-y-2">
                                    <Label htmlFor="gstValue">
                                        GST Value {formData.gstType === 'percentage' ? '(%)' : '(₹)'}
                                    </Label>
                                    <Input
                                        id="gstValue"
                                        type="number"
                                        min="0"
                                        step={formData.gstType === 'percentage' ? '0.01' : '1'}
                                        value={formData.gstValue}
                                        onChange={(e) => setFormData({ ...formData, gstValue: parseFloat(e.target.value) || 0 })}
                                        placeholder={formData.gstType === 'percentage' ? 'Enter GST percentage' : 'Enter GST amount'}
                                    />
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                {currentCategory ? 'Update' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <DialogContent
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>Delete Category?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{currentCategory?.name}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleConfirmDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};
