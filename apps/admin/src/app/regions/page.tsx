"use client";

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Plus, Edit, Trash2, Loader2 } from "lucide-react";
import {
  useGetRegionsQuery,
  useCreateRegionMutation,
  useUpdateRegionMutation,
  useDeleteRegionMutation
} from "@repo/store/services/api";
import { toast } from "sonner";

const RegionMapEditor = dynamic(() => import("../../components/RegionMapEditor"), {
  loading: () => <div className="h-[400px] flex items-center justify-center bg-gray-100 rounded-lg"><Loader2 className="animate-spin" /> Map Loading...</div>,
  ssr: false
});

type Region = {
  _id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  geometry?: any;
  cities?: string[];
  states?: string[];
};

export default function RegionsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    geometry: null,
    cities: "",
    states: ""
  });

  const { data: regionsResponse, isLoading } = useGetRegionsQuery({});
  const [createRegion, { isLoading: isCreating }] = useCreateRegionMutation();
  const [updateRegion, { isLoading: isUpdating }] = useUpdateRegionMutation();
  const [deleteRegion, { isLoading: isDeleting }] = useDeleteRegionMutation();

  const regions = regionsResponse?.data || [];

  const handleOpenModal = (region?: Region) => {
    if (region) {
      setEditingRegion(region);
      setFormData({
        name: region.name,
        code: region.code,
        description: region.description || "",
        geometry: region.geometry || null,
        cities: region.cities ? region.cities.join(", ") : "",
        states: region.states ? region.states.join(", ") : ""
      });
    } else {
      setEditingRegion(null);
      setFormData({
        name: "",
        code: "",
        description: "",
        geometry: null,
        cities: "",
        states: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRegion(null);
    setFormData({ name: "", code: "", description: "", geometry: null, cities: "", states: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        cities: formData.cities.split(",").map(c => c.trim()).filter(Boolean),
        states: formData.states.split(",").map(s => s.trim()).filter(Boolean)
      };

      if (editingRegion) {
        await updateRegion({ id: editingRegion._id, ...payload }).unwrap();
        toast.success("Region updated successfully");
      } else {
        await createRegion(payload).unwrap();
        toast.success("Region created successfully");
      }
      handleCloseModal();
    } catch (error: any) {
      console.error("Failed to save region:", error);
      toast.error(error?.data?.error || error?.data?.message || "Failed to save region");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this region?")) {
      try {
        await deleteRegion(id).unwrap();
        toast.success("Region deleted successfully");
      } catch (error: any) {
        console.error("Failed to delete region:", error);
        toast.error(error?.data?.error || error?.data?.message || "Failed to delete region");
      }
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold font-headline">Region Management</h1>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" />
          Add New Region
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Regions</CardTitle>
          <CardDescription>
            Manage geographical regions, boundaries, and assignment rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">Loading regions...</TableCell>
                  </TableRow>
                ) : regions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">No regions found.</TableCell>
                  </TableRow>
                ) : (
                  regions.map((region: Region) => (
                    <TableRow key={region._id}>
                      <TableCell className="font-medium">{region.name}</TableCell>
                      <TableCell>{region.code}</TableCell>
                      <TableCell className="max-w-xs truncate">{region.description || "-"}</TableCell>
                      <TableCell>
                        {region.geometry ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Geospatial
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            Legacy
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${region.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                          {region.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenModal(region)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(region._id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
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
      </Card>

      <Dialog open={isModalOpen} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingRegion ? "Edit Region" : "Add New Region"}</DialogTitle>
              <DialogDescription>
                Define region boundaries used for automatic vendor assignment.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 py-4">
              <div className="lg:col-span-4 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-semibold">Region Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Pune Region"
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-sm font-semibold">Region Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g. PUNE"
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-semibold">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description"
                    className="h-11"
                  />
                </div>
                <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Instructions</h4>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                    <li>Use the <strong>Search Bar</strong> on the map to find your city.</li>
                    <li>Click <strong>Draw Boundary</strong> to start.</li>
                    <li>Click points on the map to define the area.</li>
                    <li>Double-click to close the polygon.</li>
                  </ul>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-2">
                <Label className="text-sm font-semibold">Geospatial Boundary</Label>
                <div className="border-2 border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-50 relative group" style={{ height: '550px' }}>
                  <RegionMapEditor
                    initialGeometry={formData.geometry}
                    onChange={(geom) => setFormData(prev => ({ ...prev, geometry: geom }))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="sticky bottom-0 bg-white pt-4 pb-2 border-t z-50">
              <Button type="button" variant="outline" onClick={handleCloseModal} className="h-11 px-6">
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || isUpdating} className="h-11 px-8 shadow-lg shadow-primary/20">
                {(isCreating || isUpdating) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingRegion ? "Update Region" : "Create Region"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
