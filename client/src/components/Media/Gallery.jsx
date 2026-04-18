/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Trash2 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Gallery = () => {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    const fetchMedia = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/media/gallery?type=${filter}&search=${search}`);
        if(active) setMedia(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        if(active) setLoading(false);
      }
    };
    fetchMedia();
    return () => { active = false; };
  }, [filter, search]);

  return (
    <div className="gallery-container">
      <header className="gallery-header">
        <h1>Media Feed</h1>
        <div className="gallery-controls">
          <div className="search-bar">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search captions..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="filter-tabs">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
            <button className={filter === 'image' ? 'active' : ''} onClick={() => setFilter('image')}>Images</button>
            <button className={filter === 'video' ? 'active' : ''} onClick={() => setFilter('video')}>Videos</button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="loading">Loading media...</div>
      ) : (
        <div className="media-grid">
          <AnimatePresence>
            {media.map((item) => (
              <motion.div 
                key={item._id} 
                className="media-card"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                layout
              >
                <div className="media-content">
                  {item.mediaType === 'image' ? (
                    <img src={`${API_BASE_URL}${item.mediaUrl}`} alt={item.text} />
                  ) : (
                    <video controls src={`${API_BASE_URL}${item.mediaUrl}`} />
                  )}
                </div>
                <div className="media-info">
                  <p>{item.text || 'No caption'}</p>
                  <div className="media-meta">
                    <span>@{item.sender?.username}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default Gallery;
