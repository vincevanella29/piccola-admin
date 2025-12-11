// src/hooks/useCommunityUser.jsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchUserProfile, fetchPublicProfile, updateUserProfile, updateFavoriteLocation, updateProductLike, updateProfileImage, updateToggle, updateProfileField } from '../utils/communityUserData';

export function useCommunityUser(appState) {
    const { t } = useTranslation();
    const [profile, setProfile] = useState(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [isLoadingPublicProfile, setIsLoadingPublicProfile] = useState(false);
    const [isLoadingUpdateProfile, setIsLoadingUpdateProfile] = useState(false);
    const [isLoadingUpdateFavoriteLocation, setIsLoadingUpdateFavoriteLocation] = useState(false);
    const [isLoadingUpdateProductLike, setIsLoadingUpdateProductLike] = useState(false);
    const [isLoadingUpdateProfileImage, setIsLoadingUpdateProfileImage] = useState(false);
    const [isLoadingUpdateToggle, setIsLoadingUpdateToggle] = useState(false);
    const [error, setError] = useState(null);

    const fetchProfile = async () => {
        setIsLoadingProfile(true);
        setError(null);
        try {
            const walletAddress = appState?.account;
            const token = appState?.token;
            if (!token) {
                throw new Error(t('wallet.connect'));
            }
            const response = await fetchUserProfile({ walletAddress, token });
            setProfile(response);
            appState.setProfile(response);
        } catch (err) {
            setError(err.message || t('community_user.error_fetching_profile'));
            appState.setError(err.message || t('community_user.error_fetching_profile'));
        } finally {
            setIsLoadingProfile(false);
        }
    };

    const fetchPublicUserProfile = async (wallet) => {
        setIsLoadingPublicProfile(true);
        setError(null);
        try {
            const walletAddress = appState?.account;
            const token = appState?.token;
            const response = await fetchPublicProfile({ wallet, walletAddress, token });
            return response;
        } catch (err) {
            setError(err.message || t('community_user.error_fetching_profile'));
            appState.setError(err.message || t('community_user.error_fetching_profile'));
            return null;
        } finally {
            setIsLoadingPublicProfile(false);
        }
    };

    const updateProfileData = async (profileData) => {
        setIsLoadingUpdateProfile(true);
        setError(null);
        try {
            const walletAddress = appState?.account;
            const token = appState?.token;
            if (!token) {
                throw new Error(t('wallet.connect'));
            }
            const response = await updateUserProfile({ walletAddress, token, profileData });
            setProfile(response);
            appState.setProfile(response);
            appState.setSuccess(t('community_user.profile_updated'));
            return response;
        } catch (err) {
            setError(err.message || t('community_user.error_updating_profile'));
            appState.setError(err.message || t('community_user.error_updating_profile'));
        } finally {
            setIsLoadingUpdateProfile(false);
        }
    };

    const setFavoriteLocation = async (locationId) => {
        setIsLoadingUpdateFavoriteLocation(true);
        setError(null);
        try {
            const walletAddress = appState?.account;
            const token = appState?.token;
            if (!token) {
                throw new Error(t('wallet.connect'));
            }
            await updateFavoriteLocation({ walletAddress, token, locationId });
            setProfile(prev => ({ ...(prev || {}), favorite_location: locationId }));
            appState.setProfile(prev => ({ ...(prev || {}), favorite_location: locationId }));
            appState.setSuccess(t('community_user.favorite_location_updated'));
        } catch (err) {
            setError(err.message || t('community_user.error_updating_favorite_location'));
            appState.setError(err.message || t('community_user.error_updating_favorite_location'));
        } finally {
            setIsLoadingUpdateFavoriteLocation(false);
        }
    };
    
    const setProductLike = async (productId, like) => {
        setIsLoadingUpdateProductLike(true);
        setError(null);
        try {
            const walletAddress = appState?.account;
            const token = appState?.token;
            if (!token) {
                throw new Error(t('wallet.connect'));
            }
            await updateProductLike({ walletAddress, token, productId, like });
            setProfile(prev => ({
                ...(prev || {}),
                liked_products: { ...((prev && prev.liked_products) || {}), [productId]: like }
            }));
            appState.setProfile(prev => ({
                ...(prev || {}),
                liked_products: { ...((prev && prev.liked_products) || {}), [productId]: like }
            }));
            appState.setSuccess(t('community_user.product_like_updated'));
        } catch (err) {
            setError(err.message || t('community_user.error_updating_product_like'));
            appState.setError(err.message || t('community_user.error_updating_product_like'));
        } finally {
            setIsLoadingUpdateProductLike(false);
        }
    };

    const updateProfileImageUser = async (profileImage) => {
        setIsLoadingUpdateProfileImage(true);
        setError(null);
        try {
            const walletAddress = appState?.account;
            const token = appState?.token;
            if (!token) {
                throw new Error(t('wallet.connect'));
            }
            const response = await updateProfileImage({ walletAddress, token, profileImage });
            setProfile(prev => ({ ...(prev || {}), profile_image_url: response.profile_image_url }));
            appState.setProfile(prev => ({ ...(prev || {}), profile_image_url: response.profile_image_url }));
            appState.setSuccess(t('community_user.profile_image_updated'));
            return response;
        } catch (err) {
            setError(err.message || t('community_user.error_updating_profile_image'));
            appState.setError(err.message || t('community_user.error_updating_profile_image'));
        } finally {
            setIsLoadingUpdateProfileImage(false);
        }
    };

    const setToggle = async (field, value) => {
        setIsLoadingUpdateToggle(true);
        setError(null);
        try {
            const walletAddress = appState?.account;
            const token = appState?.token;
            if (!token) {
                throw new Error(t('wallet.connect'));
            }
            await updateToggle({ walletAddress, token, field, value });
            setProfile(prev => ({ ...(prev || {}), [field]: value }));
            appState.setProfile(prev => ({ ...(prev || {}), [field]: value }));
            appState.setSuccess(t('community_user.profile_updated'));
        } catch (err) {
            setError(err.message || t('community_user.error_updating_profile'));
            appState.setError(err.message || t('community_user.error_updating_profile'));
        } finally {
            setIsLoadingUpdateToggle(false);
        }
    };

    const updateProfileFieldData = async (field, value) => {
        setIsLoadingUpdateProfile(true);
        setError(null);
        try {
            const walletAddress = appState?.account;
            const token = appState?.token;
            if (!token) {
                throw new Error(t('wallet.connect'));
            }
            const response = await updateProfileField({ walletAddress, token, field, value });
            setProfile(prev => ({ ...(prev || {}), [field]: value }));
            appState.setProfile(prev => ({ ...(prev || {}), [field]: value }));
            appState.setSuccess(t('community_user.profile_updated'));
            return response;
        } catch (err) {
            setError(err.message || t('community_user.error_updating_profile'));
            appState.setError(err.message || t('community_user.error_updating_profile'));
        } finally {
            setIsLoadingUpdateProfile(false);
        }
    };
    

    return {
        profile,
        isLoadingProfile,
        isLoadingPublicProfile,
        isLoadingUpdateProfile,
        isLoadingUpdateFavoriteLocation,
        isLoadingUpdateProductLike,
        isLoadingUpdateProfileImage,
        isLoadingUpdateToggle,
        error,
        fetchProfile,
        fetchPublicUserProfile,
        updateProfileData,
        setFavoriteLocation,
        setProductLike,
        updateProfileImageUser,
        setToggle,
        updateProfileFieldData,
    };
}

export default useCommunityUser;