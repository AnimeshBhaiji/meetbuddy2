import { useState } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { MapPin, Star, Phone, Clock, Search } from "lucide-react"
import Navbar from "@/components/Navbar"

export default function RestaurantList() {
  const [searchQuery, setSearchQuery] = useState("")
  const [resultCount, setResultCount] = useState(10)
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSearch = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`http://localhost:8000/scrape?query=${encodeURIComponent(searchQuery)}&limit=${resultCount}`)
      const data = await res.json()

      if (data.error) throw new Error(data.error)
      setRestaurants(data.results || [])
    } catch (err) {
      console.error(err)
      setError("Failed to fetch restaurants.")
      setRestaurants([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Reusable Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Panel */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search for restaurants
              </label>
              <Input
                id="search"
                type="text"
                placeholder="e.g., burgers in Whitefield"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-32">
              <label htmlFor="results" className="block text-sm font-medium text-gray-700 mb-2">
                Results
              </label>
              <Input
                id="results"
                type="number"
                min="5"
                max="25"
                value={resultCount}
                onChange={(e) => setResultCount(parseInt(e.target.value) || 10)}
              />
            </div>
            <Button onClick={handleSearch} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-red-500 text-center mb-4 font-semibold">{error}</div>
        )}

        {/* Results Summary */}
        {!loading && restaurants.length > 0 && (
          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-gray-900">
              Restaurants near you ({restaurants.length} results)
            </h2>
          </div>
        )}

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {!loading && restaurants.map((restaurant, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow duration-200 overflow-hidden">
              {restaurant.Thumbnail && (
                <img
                  src={restaurant.Thumbnail}
                  alt={restaurant.Name}
                  className="w-full h-48 object-cover"
                />
              )}
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{restaurant.Name}</h3>

                <Badge variant="secondary" className="mb-3">{restaurant.Type}</Badge>

                <div className="flex items-start gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                  <p className="text-sm text-gray-600">{restaurant.Address}</p>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-600">{restaurant.Phone}</p>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium">{restaurant.Rating}</span>
                  </div>
                  <span className="text-sm text-gray-500">({restaurant["Reviews Count"]} reviews)</span>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-gray-600">{restaurant.Timings}</p>
                </div>

                <div className="mb-4">
                  <span className="text-lg font-semibold text-green-600">{restaurant.Price}</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => window.open(restaurant["Google Maps Link"], "_blank")}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  View on Google Maps
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Loading or No Results */}
        {loading && <p className="text-center mt-6 text-blue-600">Searching for restaurants...</p>}
        {!loading && restaurants.length === 0 && !error && (
          <div className="text-center py-12 text-gray-500 text-lg">
            No restaurants found. Try a different search.
          </div>
        )}
      </main>
    </div>
  )
}
