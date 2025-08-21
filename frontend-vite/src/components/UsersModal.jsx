import React, { useState, useEffect, useCallback } from "react";
import { FaUserCheck, FaTimes } from 'react-icons/fa';
import { useApi } from "../hooks/useApi";

const UsersModal = ({ show, setShow, roleLevel, companyId }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const { callApi } = useApi();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = roleLevel <= 1 ? "/contract/users" : `/contract/company/${companyId}/users`;
      const response = await callApi({
        method: "get",
        endpoint,
      });
      setUsers(response.users || []);
    } catch (err) {
      setMessage({ type: "error", text: `Error loading users, wn: ${err.message}` });
    } finally {
      setLoading(false);
    }
  }, [callApi, roleLevel, companyId]);

  useEffect(() => {
    if (show) fetchUsers();
  }, [show, fetchUsers]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleAssignRole = async (userAddress, roleName, roleLevel) => {
    try {
      await callApi({
        method: "post",
        endpoint: "/contract/assign_role",
        data: { role_name: roleName, account: userAddress, role_level: roleLevel },
      });
      setMessage({ type: "success", text: `Role ${roleName} assigned to ${userAddress}, wn!` });
      fetchUsers();
    } catch (err) {
      setMessage({ type: "error", text: `Error assigning role, wn: ${err.message}` });
    }
  };

  const handleRevokeRole = async (userAddress, roleName, roleLevel) => {
    try {
      await callApi({
        method: "post",
        endpoint: "/contract/revoke_role",
        data: { role_name: roleName, account: userAddress, role_level: roleLevel },
      });
      setMessage({ type: "success", text: `Role ${roleName} revoked from ${userAddress}, wn!` });
      fetchUsers();
    } catch (err) {
      setMessage({ type: "error", text: `Error revoking role, wn: ${err.message}` });
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0A0A0A] bg-opacity-95 z-50 transition-opacity duration-300">
      <div className="relative w-full max-w-md sm:max-w-2xl bg-[#151515] rounded-lg overflow-hidden border border-[#1DA1F2] shadow-[0_0_20px_rgba(29,161,242,0.3)]">
        <div className="flex justify-between items-center p-4 bg-[#151515] border-b border-[#252525]">
          <h2 className="text-lg sm:text-xl text-[#E0E0E0] font-semibold">
            {roleLevel <= 1 ? "All Users" : "Company Users"}
          </h2>
          <button
            onClick={() => setShow(false)}
            className="text-[#B0B0B0] hover:text-[#1DA1F2] p-2 rounded-full bg-[#252525] hover:bg-[#353535] transition-all duration-200 hover:rotate-90 active:scale-105"
          >
            <FaTimes size={16} />
          </button>
        </div>
        <div className="p-4 max-h-[80vh] overflow-y-auto">
          {message && (
            <div
              className={`mb-4 p-2 rounded-md text-sm text-[#E0E0E0] animate-slide-in ${
                message.type === "success" ? "bg-[#1DA1F2]/80" : "bg-[#EF4444]/80"
              }`}
            >
              {message.text}
            </div>
          )}
          {loading ? (
            <div className="text-center py-8">
              <svg
                className="animate-spin h-6 w-6 text-[#1DA1F2] mx-auto"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-[#B0B0B0] mt-2 text-sm">Loading...</p>
            </div>
          ) : (
            <div>
              {users.length === 0 ? (
                <p className="text-center text-[#B0B0B0] py-8 text-sm">No users found, wn.</p>
              ) : (
                <div className="hidden sm:block">
                  <table className="w-full text-left text-sm text-[#E0E0E0]">
                    <thead className="text-[#1DA1F2] uppercase text-xs">
                      <tr>
                        <th className="p-2">Address</th>
                        <th className="p-2">Role</th>
                        <th className="p-2">Level</th>
                        <th className="p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr
                          key={user.address}
                          className="hover:bg-[#353535] transition-all duration-200 hover:scale-[1.02] cursor-pointer"
                        >
                          <td className="p-2">{user.address}</td>
                          <td className="p-2">{user.role_name || "None"}</td>
                          <td className="p-2">{user.role_level || "-"}</td>
                          <td className="p-2">
                            {roleLevel <= 1 && !user.is_active && (
                              <button
                                onClick={() => handleAssignRole(user.address, "LEGATUS_STELLAE", 1)}
                                className="relative flex items-center gap-1 bg-[#1DA1F2] hover:bg-[#0D8ECE] text-[#E0E0E0] px-3 py-1 rounded-md text-sm transition-all duration-200 group"
                              >
                                <FaUserCheck className="group-hover:scale-125" />
                                <span>Assign Admin</span>
                              </button>
                            )}
                            {user.is_active && (
                              <button
                                onClick={() => handleRevokeRole(user.address, user.role_name, user.role_level)}
                                className="relative flex items-center gap-1 bg-[#EF4444] hover:bg-[#B91C1C] text-[#E0E0E0] px-3 py-1 rounded-md text-sm transition-all duration-200 group"
                              >
                                <FaTimes className="group-hover:scale-125" />
                                <span>Revoke Role</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsersModal;
