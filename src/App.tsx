import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, Shuffle, MapPin, Filter, Heart, Users, Clock, DollarSign } from 'lucide-react'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select'
import { Slider } from './components/ui/slider'
import { Checkbox } from './components/ui/checkbox'
import { blink } from './blink/client'

interface Event {
  id: string
  name: string
  category: string
  description: string
  city: string
  idealGroupSize: string
  durationHours: number
  costPerPerson: number
  meetingPoint: string
  transitTips?: string
  bookingLink?: string
  bestMonths: string
  accessibilityNotes?: string
  imageUrl: string
}

const categoryIcons = {
  'Outdoor/Tour': '🌊',
  'Entertainment': '🎭',
  'Food & Drink': '🍽️',
  'Team Building': '🤝',
  'Outdoor/Adventure': '🚴',
  'Culture/Arts': '🎨',
  'Sports/Tour': '⚾',
  'Outdoor/Team Building': '🦁',
  'Entertainment/Tour': '🎪',
  'Team Building/Culture': '🏛️',
  'Outdoor/Creative': '📸',
  'Entertainment/Adventure': '🪓',
  'Team Building/Urban': '🏙️'
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState<'chicago' | 'minneapolis'>('chicago')
  const [searchQuery, setSearchQuery] = useState('')
  const [events, setEvents] = useState<Event[]>([])
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  
  // Filter states
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [costRange, setCostRange] = useState([0, 100])
  const [durationRange, setDurationRange] = useState([0, 5])

  // Auth state management
  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      console.log('🔐 Auth state changed:', state)
      setUser(state.user)
      setLoading(state.isLoading)
    })
    return unsubscribe
  }, [])

  const loadEvents = useCallback(async () => {
    try {
      console.log('🔍 Loading events for city:', selectedCity)
      const result = await blink.db.events.list({
        where: { city: selectedCity === 'chicago' ? 'chicago' : 'minneapolis' },
        orderBy: { name: 'asc' }
      })
      
      console.log('📊 Raw events from database:', result)
      
      // Convert snake_case to camelCase
      const formattedEvents = result.map(event => ({
        id: event.id,
        name: event.name,
        category: event.category,
        description: event.description,
        city: event.city,
        idealGroupSize: event.ideal_group_size,
        durationHours: event.duration_hours,
        costPerPerson: event.cost_per_person,
        meetingPoint: event.meeting_point,
        transitTips: event.transit_tips,
        bookingLink: event.booking_link,
        bestMonths: event.best_months,
        accessibilityNotes: event.accessibility_notes,
        imageUrl: event.image_url
      }))
      
      console.log('✅ Formatted events:', formattedEvents)
      setEvents(formattedEvents)
    } catch (error) {
      console.error('❌ Failed to load events:', error)
    }
  }, [selectedCity])

  const loadFavorites = useCallback(async () => {
    if (!user) return
    try {
      const result = await blink.db.favorites.list({
        where: { userId: user.id }
      })
      setFavorites(new Set(result.map(f => f.eventId)))
    } catch (error) {
      console.error('Failed to load favorites:', error)
    }
  }, [user])

  const filterEvents = useCallback(() => {
    console.log('🔍 Filtering events. Total events:', events.length)
    console.log('🔍 Filter criteria:', { searchQuery, selectedCategories, costRange, durationRange })
    let filtered = events

    // Search filter
    if (searchQuery) {
      const beforeSearch = filtered.length
      filtered = filtered.filter(event =>
        event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
      console.log(`🔍 After search filter: ${beforeSearch} → ${filtered.length}`)
    }

    // Category filter
    if (selectedCategories.length > 0) {
      const beforeCategory = filtered.length
      filtered = filtered.filter(event =>
        selectedCategories.includes(event.category)
      )
      console.log(`🔍 After category filter: ${beforeCategory} → ${filtered.length}`)
    }

    // Cost filter
    const beforeCost = filtered.length
    filtered = filtered.filter(event => {
      const cost = Number(event.costPerPerson)
      const passes = cost >= costRange[0] && cost <= costRange[1]
      if (!passes) {
        console.log(`🔍 Cost filter rejected: ${event.name} (${cost}) not in range [${costRange[0]}-${costRange[1]}]`)
      }
      return passes
    })
    console.log(`🔍 After cost filter: ${beforeCost} → ${filtered.length}`)

    // Duration filter
    const beforeDuration = filtered.length
    filtered = filtered.filter(event => {
      const duration = Number(event.durationHours)
      const passes = duration >= durationRange[0] && duration <= durationRange[1]
      if (!passes) {
        console.log(`🔍 Duration filter rejected: ${event.name} (${duration}h) not in range [${durationRange[0]}-${durationRange[1]}h]`)
      }
      return passes
    })
    console.log(`🔍 After duration filter: ${beforeDuration} → ${filtered.length}`)

    console.log('✅ Filtered events:', filtered.length)
    setFilteredEvents(filtered)
  }, [events, searchQuery, selectedCategories, costRange, durationRange])

  const toggleFavorite = async (eventId: string) => {
    if (!user) return
    
    try {
      if (favorites.has(eventId)) {
        // Remove from favorites
        const favoriteRecord = await blink.db.favorites.list({
          where: { userId: user.id, eventId }
        })
        if (favoriteRecord.length > 0) {
          await blink.db.favorites.delete(favoriteRecord[0].id)
        }
        setFavorites(prev => {
          const newSet = new Set(prev)
          newSet.delete(eventId)
          return newSet
        })
      } else {
        // Add to favorites
        await blink.db.favorites.create({
          userId: user.id,
          eventId,
          createdAt: new Date()
        })
        setFavorites(prev => new Set([...prev, eventId]))
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
    }
  }

  const surpriseMe = () => {
    if (filteredEvents.length > 0) {
      const randomEvent = filteredEvents[Math.floor(Math.random() * filteredEvents.length)]
      setSelectedEvent(randomEvent)
    }
  }

  const categories = [...new Set(events.map(e => e.category))]

  // Load events when city changes
  useEffect(() => {
    console.log('🔄 Effect triggered. User:', !!user, 'Loading:', loading)
    if (!user || loading) return
    loadEvents()
    loadFavorites()
  }, [loadEvents, loadFavorites, user, loading])

  // Filter events when search or filters change
  useEffect(() => {
    filterEvents()
  }, [filterEvents])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your event ideas...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome to Case Team Events</CardTitle>
            <p className="text-muted-foreground">Please sign in to discover amazing team event ideas</p>
          </CardHeader>
          <CardContent>
            <Button onClick={() => blink.auth.login()} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-primary">Case Team Events</h1>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                Beta Launch
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">Welcome, {user.email}</span>
              <Button variant="outline" size="sm" onClick={() => blink.auth.logout()}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-gray-900 mb-4"
          >
            Discover Amazing Team Events
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-muted-foreground mb-8"
          >
            Curated experiences for consulting teams in Chicago and Minneapolis
          </motion.p>

          {/* City Selector */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center mb-8"
          >
            <div className="bg-white rounded-full p-1 shadow-lg">
              <Button
                variant={selectedCity === 'chicago' ? 'default' : 'ghost'}
                className="rounded-full px-6"
                onClick={() => setSelectedCity('chicago')}
              >
                <MapPin className="w-4 h-4 mr-2" />
                Chicago
              </Button>
              <Button
                variant={selectedCity === 'minneapolis' ? 'default' : 'ghost'}
                className="rounded-full px-6"
                onClick={() => setSelectedCity('minneapolis')}
              >
                <MapPin className="w-4 h-4 mr-2" />
                Minneapolis
              </Button>
            </div>
          </motion.div>

          {/* Search and Actions */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filter Events</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  {/* Categories */}
                  <div>
                    <h3 className="font-medium mb-3">Categories</h3>
                    <div className="space-y-2">
                      {categories.map(category => (
                        <div key={category} className="flex items-center space-x-2">
                          <Checkbox
                            id={category}
                            checked={selectedCategories.includes(category)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedCategories([...selectedCategories, category])
                              } else {
                                setSelectedCategories(selectedCategories.filter(c => c !== category))
                              }
                            }}
                          />
                          <label htmlFor={category} className="text-sm">
                            {categoryIcons[category]} {category}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cost Range */}
                  <div>
                    <h3 className="font-medium mb-3">Cost per Person</h3>
                    <Slider
                      value={costRange}
                      onValueChange={setCostRange}
                      max={100}
                      step={5}
                      className="mb-2"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>${costRange[0]}</span>
                      <span>${costRange[1]}</span>
                    </div>
                  </div>

                  {/* Duration Range */}
                  <div>
                    <h3 className="font-medium mb-3">Duration (Hours)</h3>
                    <Slider
                      value={durationRange}
                      onValueChange={setDurationRange}
                      max={5}
                      step={0.5}
                      className="mb-2"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{durationRange[0]}h</span>
                      <span>{durationRange[1]}h</span>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <Button onClick={surpriseMe} className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90">
              <Shuffle className="w-4 h-4 mr-2" />
              Surprise Me
            </Button>
          </motion.div>
        </div>

        {/* Results */}
        <div className="mb-6">
          <p className="text-muted-foreground">
            Found {filteredEvents.length} events in {selectedCity === 'chicago' ? 'Chicago' : 'Minneapolis'}
          </p>
        </div>

        {/* Events Grid */}
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredEvents.map((event, index) => (
            <motion.div
              key={event.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="card-hover cursor-pointer h-full" onClick={() => setSelectedEvent(event)}>
                <div className="relative">
                  <img
                    src={event.imageUrl}
                    alt={event.name}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(event.id)
                    }}
                  >
                    <Heart className={`w-4 h-4 ${favorites.has(event.id) ? 'fill-red-500 text-red-500' : ''}`} />
                  </Button>
                  <Badge className="absolute top-2 left-2 bg-white/90 text-gray-900">
                    ${event.costPerPerson}
                  </Badge>
                </div>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg leading-tight">{event.name}</CardTitle>
                    <span className="text-2xl ml-2">{categoryIcons[event.category]}</span>
                  </div>
                  <Badge variant="secondary" className="w-fit">
                    {event.category}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                    {event.description}
                  </p>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      {event.idealGroupSize}
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {event.durationHours}h
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {filteredEvents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No events found matching your criteria.</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {
                setSearchQuery('')
                setSelectedCategories([])
                setCostRange([0, 100])
                setDurationRange([0, 5])
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </main>

      {/* Event Detail Modal */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedEvent.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <img
                  src={selectedEvent.imageUrl}
                  alt={selectedEvent.name}
                  className="w-full h-64 object-cover rounded-lg"
                />
                
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    {categoryIcons[selectedEvent.category]} {selectedEvent.category}
                  </Badge>
                  <Button
                    variant={favorites.has(selectedEvent.id) ? "default" : "outline"}
                    onClick={() => toggleFavorite(selectedEvent.id)}
                  >
                    <Heart className={`w-4 h-4 mr-2 ${favorites.has(selectedEvent.id) ? 'fill-current' : ''}`} />
                    {favorites.has(selectedEvent.id) ? 'Favorited' : 'Add to Favorites'}
                  </Button>
                </div>

                <p className="text-muted-foreground">{selectedEvent.description}</p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <Users className="w-5 h-5 mr-2 text-primary" />
                    <div>
                      <p className="font-medium">Group Size</p>
                      <p className="text-sm text-muted-foreground">{selectedEvent.idealGroupSize}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-primary" />
                    <div>
                      <p className="font-medium">Duration</p>
                      <p className="text-sm text-muted-foreground">{selectedEvent.durationHours} hours</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="w-5 h-5 mr-2 text-primary" />
                    <div>
                      <p className="font-medium">Cost per Person</p>
                      <p className="text-sm text-muted-foreground">${selectedEvent.costPerPerson}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-primary" />
                    <div>
                      <p className="font-medium">Best Months</p>
                      <p className="text-sm text-muted-foreground">{selectedEvent.bestMonths}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Meeting Point</h3>
                    <p className="text-sm text-muted-foreground">{selectedEvent.meetingPoint}</p>
                  </div>
                  
                  {selectedEvent.transitTips && (
                    <div>
                      <h3 className="font-medium mb-2">Transit Tips</h3>
                      <p className="text-sm text-muted-foreground">{selectedEvent.transitTips}</p>
                    </div>
                  )}
                  
                  {selectedEvent.accessibilityNotes && (
                    <div>
                      <h3 className="font-medium mb-2">Accessibility</h3>
                      <p className="text-sm text-muted-foreground">{selectedEvent.accessibilityNotes}</p>
                    </div>
                  )}
                </div>

                {selectedEvent.bookingLink && (
                  <Button asChild className="w-full">
                    <a href={selectedEvent.bookingLink} target="_blank" rel="noopener noreferrer">
                      Book This Event
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App