"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import {
  MessageSquare, Users, MessageCircle, Ticket,
  Clock, RefreshCw, Eye, ArrowLeft, CheckCircle,
  Star, Zap, Instagram, Facebook, Youtube, Twitter, Linkedin
} from 'lucide-react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import MarketingTicketModal from './MarketingTicketModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@repo/ui/dialog';

type MarketingPackage = {
  _id: string;
  name: string;
  price: number;
  description?: string;
  features: string[];
  platforms: string[];
  isActive: boolean;
};

type TicketItem = {
  _id: string;
  subject: string;
  description: string;
  status: string;
  adminNotes?: string;
  packageId?: {
    name: string;
    price: number;
  };
  agentId?: {
    name: string;
    email: string;
    phone?: string;
  };
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  "Pending": "bg-amber-100 text-amber-800 border-amber-200",
  "Assigned": "bg-blue-100 text-blue-800 border-blue-200",
  "In Progress": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Resolved": "bg-green-100 text-green-800 border-green-200",
  "Closed": "bg-slate-100 text-slate-800 border-slate-200"
};

const PLATFORM_ICONS: Record<string, ReactNode> = {
  "Instagram": <Instagram className="h-3.5 w-3.5" />,
  "Facebook": <Facebook className="h-3.5 w-3.5" />,
  "YouTube": <Youtube className="h-3.5 w-3.5" />,
  "Twitter/X": <Twitter className="h-3.5 w-3.5" />,
  "LinkedIn": <Linkedin className="h-3.5 w-3.5" />,
  "WhatsApp": <MessageCircle className="h-3.5 w-3.5" />,
};

export default function MarketingPage() {
  // View state: 'home' | 'packages'
  const [view, setView] = useState<'home' | 'packages'>('home');

  const [packages, setPackages] = useState<MarketingPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  const [selectedPackage, setSelectedPackage] = useState<MarketingPackage | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Ticket Detail Dialog State
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchPackages = async () => {
    setLoadingPackages(true);
    try {
      const res = await fetch('/api/crm/marketing/packages');
      if (res.ok) {
        const data = await res.json();
        setPackages((data.data || []).filter((p: MarketingPackage) => p.isActive));
      }
    } catch (error) {
      console.error("Failed to fetch packages:", error);
    } finally {
      setLoadingPackages(false);
    }
  };

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await fetch('/api/crm/marketing/tickets');
      if (res.ok) {
        const data = await res.json();
        setTickets(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch tickets:", error);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSocialMediaMarketingClick = () => {
    setView('packages');
    if (packages.length === 0) fetchPackages();
  };

  const handleSelectPackage = (pkg: MarketingPackage) => {
    setSelectedPackage(pkg);
    setIsTicketModalOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleOpenDetail = (ticket: TicketItem) => {
    setSelectedTicket(ticket);
    setIsDetailOpen(true);
  };

  // ─── Package Selection View ───────────────────────────────────────────────
  if (view === 'packages') {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => setView('home')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Social Media Marketing</h1>
            <p className="text-muted-foreground">Choose a package to get started with your marketing request</p>
          </div>
        </div>

        {/* Packages Grid */}
        {loadingPackages ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl overflow-hidden border animate-pulse">
                <div className="h-36 bg-slate-200" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-5/6" />
                  <div className="h-9 bg-slate-200 rounded-lg mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-20 border border-dashed rounded-2xl bg-slate-50/50">
            <Ticket className="h-14 w-14 mx-auto text-slate-300 mb-4" />
            <p className="text-base font-semibold text-muted-foreground">No packages available</p>
            <p className="text-sm text-muted-foreground mt-1">Please check back later or contact support.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <div
                key={pkg._id}
                className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col bg-white"
              >
                {/* Card Header — dark monochrome */}
                <div className="bg-slate-900 p-6 text-white relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/5" />
                  <div className="absolute -bottom-6 -left-2 w-16 h-16 rounded-full bg-white/5" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                        <Star className="h-5 w-5 text-white" />
                      </div>
                      <span className="bg-white/10 text-white text-xs font-bold px-3 py-1 rounded-full border border-white/20">
                        ₹{pkg.price.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold leading-tight">{pkg.name}</h3>
                    {pkg.description && (
                      <p className="text-slate-400 text-xs mt-1 line-clamp-2">{pkg.description}</p>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex flex-col flex-1 gap-4">
                  {/* Platforms */}
                  {pkg.platforms?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Platforms</p>
                      <div className="flex flex-wrap gap-1.5">
                        {pkg.platforms.map((platform) => (
                          <span
                            key={platform}
                            className="flex items-center gap-1 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full"
                          >
                            {PLATFORM_ICONS[platform]}
                            {platform}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Features */}
                  {pkg.features?.length > 0 && (
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Includes</p>
                      <ul className="space-y-1.5">
                        {pkg.features.map((feature, fi) => (
                          <li key={fi} className="flex items-start gap-2 text-sm text-slate-700">
                            <CheckCircle className="h-3.5 w-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* CTA */}
                  <Button
                    className="w-full bg-slate-900 hover:bg-slate-700 text-white border-0 shadow-sm gap-2 mt-auto"
                    onClick={() => handleSelectPackage(pkg)}
                  >
                    <Zap className="h-4 w-4" />
                    Create Ticket
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ticket Modal */}
        <MarketingTicketModal
          open={isTicketModalOpen}
          onOpenChange={setIsTicketModalOpen}
          onTicketCreated={() => {
            fetchTickets();
            setView('home');
          }}
          preSelectedPackage={selectedPackage}
        />
      </div>
    );
  }

  // ─── Home View ────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Marketing</h1>
        <p className="text-muted-foreground">Create and manage your marketing content</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Social Post Creator */}
        <Link href="/marketing/social-media-templates">
          <Card className="cursor-pointer hover:shadow-md hover:border-slate-400 transition-shadow h-full">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full">
              <div className="bg-slate-100 p-4 rounded-full mb-4">
                <MessageSquare className="h-8 w-8 text-slate-700" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Social Post Creator</h3>
              <p className="text-sm text-muted-foreground">Create and schedule social media posts</p>
            </CardContent>
          </Card>
        </Link>

        {/* Social Media Marketing (Package Selection → Ticket Generation) */}
        <Card
          className="cursor-pointer hover:shadow-md hover:border-slate-600 transition-colors border h-full"
          onClick={handleSocialMediaMarketingClick}
        >
          <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full">
            <div className="bg-slate-900 p-4 rounded-full mb-4">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Social Media Marketing</h3>
            <p className="text-sm text-muted-foreground">Create a ticket for custom graphics & ad management</p>
          </CardContent>
        </Card>

        {/* WhatsApp Message Blast — Coming Soon */}
        <div className="relative h-full">
          <Card className="cursor-not-allowed opacity-70 h-full select-none">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full">
              <div className="bg-green-100 p-4 rounded-full mb-4">
                <MessageCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">WhatsApp Message Blast</h3>
              <p className="text-sm text-muted-foreground">Send bulk WhatsApp messages to your customers</p>
            </CardContent>
          </Card>
          <span className="absolute top-3 right-3 bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shadow-sm">
            Coming Soon
          </span>
        </div>
      </div>

      {/* Ticket History Section */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-slate-700" />
            <h2 className="text-xl font-bold">Marketing Support Tickets</h2>
          </div>
          <Button variant="outline" size="sm" onClick={fetchTickets} disabled={loadingTickets} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loadingTickets ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loadingTickets && tickets.length === 0 ? (
          <div className="space-y-4 py-8">
            <div className="h-12 w-full bg-muted rounded animate-pulse" />
            <div className="h-12 w-full bg-muted rounded animate-pulse" />
            <div className="h-12 w-full bg-muted rounded animate-pulse" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-xl bg-slate-50/50">
            <Ticket className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">No marketing tickets found</p>
            <p className="text-xs text-muted-foreground mt-1">Raise your first request by clicking on "Social Media Marketing" above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground font-medium">
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Package</th>
                  <th className="py-3 px-4">Agent</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t._id} className="border-b hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-[200px] truncate">
                      {t.subject}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {t.packageId?.name || 'Custom Package'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {t.agentId?.name || 'Auto-assigning'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-xs">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(t.createdAt)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[t.status] || 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDetail(t)} title="View details">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div>
                <DialogTitle className="text-lg font-bold">Ticket Details</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  View full request information and updates.
                </DialogDescription>
              </div>
              {selectedTicket && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[selectedTicket.status] || 'bg-slate-100 text-slate-800'}`}>
                  {selectedTicket.status}
                </span>
              )}
            </div>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4 text-sm">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Subject</span>
                <p className="font-semibold text-slate-800 text-base">{selectedTicket.subject}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Marketing Package</span>
                  <p className="font-medium text-slate-700">{selectedTicket.packageId?.name || 'Custom Package'}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Assigned Agent</span>
                  <p className="font-medium text-slate-700">{selectedTicket.agentId?.name || 'Auto-assigning'}</p>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Description</span>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-700 text-sm whitespace-pre-wrap leading-relaxed max-h-[150px] overflow-y-auto">
                  {selectedTicket.description}
                </div>
              </div>

              {selectedTicket.adminNotes && (
                <div className="border-t pt-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Admin Response / Update Notes</span>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                    {selectedTicket.adminNotes}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button onClick={() => setIsDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}